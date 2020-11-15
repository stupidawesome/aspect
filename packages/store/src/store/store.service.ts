import {
    Inject,
    Injectable,
    InjectionToken,
    Injector,
    OnDestroy,
    Optional,
    Self,
    Type,
} from "@angular/core"
import { Ref } from "@aspect/core"
import {
    Observable,
    OperatorFunction,
    pipe,
    queueScheduler,
    scheduled,
    Subject,
    Subscription,
    throwError,
} from "rxjs"
import { catchError, delay, filter, scan } from "rxjs/operators"

const REDUCERS = new InjectionToken("REDUCERS")
const EFFECTS = new InjectionToken("EFFECTS")
const STORE_INITIALIZER = new InjectionToken<StoreInitializer[]>(
    "STORE_INITIALIZER",
)

export class Actions extends Subject<Action> {}

@Injectable()
export class Dispatcher extends Subject<Action> implements OnDestroy {
    sink

    dispatch(_action: Action) {
        this.next(_action)
    }

    ngOnDestroy() {
        this.sink.unsubscribe()
    }

    constructor(actions: Actions) {
        super()

        this.sink = this.pipe(delay(0)).subscribe(actions)
    }
}

@Injectable()
export class StoreService implements StoreInitializer, OnDestroy {
    private sink

    onStoreInit(state: Ref<any>) {
        const { reducerFactories, dispatcher } = this

        for (const reducerFactory of reducerFactories) {
            for (const [reducer, allowedActions] of reducerFactory.reducers) {
                const sub = scheduled(dispatcher, queueScheduler)
                    .pipe(
                        filter((_action) =>
                            (<any[]>allowedActions).some(
                                (allowedAction) =>
                                    allowedAction.type === _action.type,
                            ),
                        ),
                        scan(reducer, reducerFactory.selector(state)),
                    )
                    .subscribe()
                this.sink.add(sub)
            }
        }
    }

    ngOnDestroy() {
        this.sink.unsubscribe()
    }

    constructor(
        private injector: Injector,
        @Inject(REDUCERS) private reducerFactories: Reducer<any, any>[],
        private dispatcher: Dispatcher,
    ) {
        this.sink = new Subscription()
    }
}

interface StoreInitializer {
    onStoreInit(state: Ref<any>): void
}

@Injectable()
export class EffectsService implements StoreInitializer, OnDestroy {
    sink

    onStoreInit(state: Ref<any>) {
        const { effectFactories, dispatcher, injector } = this
        for (const effectFactory of effectFactories) {
            const deps = injector.get(effectFactory.deps)
            const { options } = effectFactory
            for (const effect of effectFactory.effects) {
                const source: Observable<Action> = effect(deps, state).pipe(
                    catchError((error) => {
                        if (options.restartOnError) {
                            console.error(error)
                            return source
                        }
                        return throwError(error)
                    }),
                )
                this.sink.add(source.subscribe(dispatcher))
            }
        }
    }

    ngOnDestroy() {
        this.sink.unsubscribe()
    }

    constructor(
        @Inject(EFFECTS) private effectFactories: EffectFactory<any>[],
        private dispatcher: Dispatcher,
        private injector: Injector,
    ) {
        this.sink = new Subscription()
    }
}

export function createState<T extends () => any>(fn: T) {
    return class {
        constructor() {
            return fn()
        }
    } as Type<ReturnType<T>>
}

export type ActionType<T> = T extends (...args: any[]) => infer R ? R : never

export function ofType<
    T extends [(...args: any[]) => Action, ...((...args: any[]) => Action)[]]
>(...actionTypes: T): OperatorFunction<Action, ReturnType<T[number]>> {
    return function (source) {
        return source.pipe(
            filter((_action) =>
                actionTypes.some(
                    (actionType) => (<any>actionType).type === _action.type,
                ),
            ),
        ) as Observable<ReturnType<T[number]>>
    }
}

class Reducer<T, U extends Ref<any>> {
    reducers: [(state: T, actions: ActionType<any>) => any, ActionType<any>][]
    selector: (state: T) => Ref<any>
    provider

    add<V extends [...((...args: any[]) => any)[]]>(
        fn: (state: U, action: ActionType<V[number]>) => any,
        actions: V,
    ) {
        this.reducers.push([fn as any, actions])
        return this
    }

    select<V extends Ref<any>>(selector: (state: U) => V) {
        return new Reducer<T, V>(
            pipe(this.selector as any, selector) as V,
            this.provider,
        )
    }

    constructor(selector: (state: T) => U, provider: any) {
        this.selector = selector
        this.reducers = [] as [(state: T, action: any) => any, any][]
        this.provider = provider
    }
}

interface EffectOptions {
    restartOnError: boolean
}

const defaultEffectOptions: EffectOptions = {
    restartOnError: false,
}

class EffectFactory<
    T extends Type<any>,
    U extends Ref<any> | unknown = unknown
> {
    deps
    effects
    options

    add(fn: (ctx: InstanceType<T>, state: U) => any) {
        this.effects.push(fn)
        return this
    }

    constructor(deps: T) {
        this.deps = deps
        this.effects = [] as Function[]
        this.options = defaultEffectOptions
    }
}

export function createReducer<T extends ReturnType<typeof createState>>(
    stateProvider: T,
) {
    return new Reducer<State<T>, State<T>>((s) => s, stateProvider)
}

export function createEffect<
    T extends Type<any>,
    U extends ReturnType<typeof createState>
>(deps: T, stateProvider?: U) {
    return new EffectFactory<T, State<U>>(deps)
}

export type State<T extends new () => any> = InstanceType<T>

class ActionBuilder<
    TType extends string = string,
    TData extends (...args: any[]) => any = () => {}
> {
    withData<U extends {}>(): ReturnType<
        ActionBuilder<TType, (data: U) => U>["create"]
    >
    withData<U extends (...args: any[]) => any>(
        fn: U,
    ): ReturnType<ActionBuilder<TType, U>["create"]>
    withData(fn = (data: TData) => data): any {
        return new ActionBuilder(this.type, fn).create()
    }

    create() {
        const { data, type } = this
        function action(
            ...args: TData extends (...args: infer R) => infer S ? R : never
        ) {
            const _action = {}
            const value = data(...args)
            Object.defineProperties(_action, {
                type: {
                    value: type,
                },
                data: {
                    enumerable: true,
                    value,
                },
            })
            return _action as {
                readonly type: TType
                readonly data: TData extends (...args: any[]) => infer S
                    ? void extends S
                        ? undefined
                        : S
                    : undefined
            }
        }
        action.type = this.type
        return action
    }

    constructor(readonly type: TType, private data: TData) {}
}

export function createAction<T extends string>(type: T) {
    return new ActionBuilder(type, () => {})
}

export function createStore(
    stateProvider: State<any>,
    additionalProviders?: any[],
) {
    return [
        {
            provide: stateProvider,
            useFactory(initializers?: StoreInitializer[]) {
                const state = new stateProvider()
                for (const initializer of initializers ?? []) {
                    initializer.onStoreInit(state)
                }
                return state
            },
            deps: [[STORE_INITIALIZER, new Optional(), new Self()]],
        },
        additionalProviders ?? [],
        Dispatcher,
        Actions,
    ]
}

export interface Action {
    readonly type: string
}

export function withReducers(...reducers: Reducer<any, any>[]) {
    return [
        StoreService,
        {
            provide: REDUCERS,
            useValue: reducers,
        },
        {
            provide: STORE_INITIALIZER,
            useClass: StoreService,
            multi: true,
        },
    ]
}

export function withEffects(...effects: EffectFactory<any>[]) {
    return [
        EffectsService,
        {
            provide: EFFECTS,
            useValue: effects,
        },
        {
            provide: STORE_INITIALIZER,
            useClass: EffectsService,
            multi: true,
        },
    ]
}
