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
    MonoTypeOperatorFunction,
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
import { Callable } from "../../../core/src/callable"

const REDUCERS = new InjectionToken("REDUCERS")
const EFFECTS = new InjectionToken("EFFECTS")
export const STORE_INITIALIZER = new InjectionToken("STORE_INITIALIZER")

@Injectable({ providedIn: "root" })
export class Actions extends Subject<Action> {}

@Injectable({ providedIn: "root" })
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

        this.sink = this.subscribe(actions)
    }
}

export interface Dispatch {
    (action: Action): void
}

@Injectable({ providedIn: "root" })
export class Dispatch extends Callable<(action: Action) => void> {
    constructor(dispatcher: Dispatcher) {
        super((action) => dispatcher.dispatch(action))
    }
}

@Injectable()
export class StoreService implements OnDestroy {
    private sink

    ngOnDestroy() {
        this.sink.unsubscribe()
    }

    constructor(
        @Inject(REDUCERS) private reducerFactories: Reducer<any, any>[],
        @Inject(STATE) state: any,
        dispatcher: Dispatcher,
    ) {
        this.sink = new Subscription()

        for (const reducerFactory of reducerFactories) {
            for (const [reducer, allowedActions] of reducerFactory.reducers) {
                const sub = scheduled(dispatcher, queueScheduler)
                    .pipe(
                        filter((_action) =>
                            (<any[]>allowedActions).some(
                                (allowedAction) =>
                                    allowedAction.name === _action.name,
                            ),
                        ),
                        scan((nextState, action) => {
                            nextState(reducer(nextState(), action.data))
                            return nextState
                        }, reducerFactory.selector(state)),
                    )
                    .subscribe()
                this.sink.add(sub)
            }
        }
    }
}

@Injectable()
export class EffectsService implements OnDestroy {
    sink

    ngOnDestroy() {
        this.sink.unsubscribe()
    }

    constructor(
        @Inject(EFFECTS) effectFactories: EffectFactory<any>[],
        @Inject(STATE) state: any,
        dispatcher: Dispatcher,
        injector: Injector,
    ) {
        this.sink = new Subscription()

        for (const effectFactory of effectFactories) {
            const deps = injector.get(effectFactory.deps)
            for (const [effect, options] of effectFactory.effects) {
                const source: Observable<Action> = effect(deps, state).pipe(
                    catchError((error, caught) => {
                        const value = options.restartOnError
                            ? caught
                            : throwError(error)
                        console.error(error)
                        dispatcher.dispatch(error)
                        return value
                    }),
                )
                this.sink.add(source.subscribe(dispatcher))
            }
        }
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
                    (actionType) => (<any>actionType).name === _action.name,
                ),
            ),
        ) as Observable<ReturnType<T[number]>>
    }
}

export class Reducer<T, U extends Ref<any>> {
    reducers: [(state: T, actions: ActionType<any>) => any, ActionType<any>][]
    selector: (state: T) => Ref<any>
    provider

    add<V extends [...((...args: any[]) => any)[]]>(
        fn: (
            state: ReturnType<U>,
            action: ActionType<V[number]>["data"],
        ) => ReturnType<U> | void,
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

    add(
        fn: (ctx: InstanceType<T>, state: U) => any,
        options: EffectOptions = defaultEffectOptions,
    ) {
        this.effects.push([fn, options])
        return this
    }

    constructor(deps: T) {
        this.deps = deps
        this.effects = [] as [Function, EffectOptions][]
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
        return new ActionBuilder(this.name, fn).create()
    }

    create() {
        const { data, name } = this
        function action(
            ...args: TData extends (...args: infer R) => infer S ? R : never
        ) {
            const _action = {}
            const value = data(...args)
            Object.defineProperties(_action, {
                name: {
                    value: name,
                },
                data: {
                    enumerable: true,
                    value,
                },
            })
            return _action as {
                readonly name: TType
                readonly data: TData extends (...args: any[]) => infer S
                    ? void extends S
                        ? undefined
                        : S
                    : undefined
            }
        }
        Object.defineProperty(action, "name", {
            value: this.name,
            enumerable: true,
        })
        return action
    }

    constructor(readonly name: TType, private data: TData) {}
}

export function createAction<T extends string>(name: T) {
    return new ActionBuilder(name, () => {})
}

export type ActionFactory<TType = string, TData = any> = (
    ...args: TData extends (...args: infer R) => infer S ? R : never
) => {
    readonly name: TType
    readonly data: TData extends (...args: any[]) => infer S
        ? void extends infer S
            ? undefined
            : S
        : undefined
}

export function createStore(
    stateProvider: State<any>,
    additionalProviders?: any[],
) {
    return [
        stateProvider,
        additionalProviders ?? [],
        {
            provide: STATE,
            useExisting: stateProvider,
        },
    ]
}

export const STATE = new InjectionToken("STATE")

export interface Action {
    readonly name: string
    readonly data: unknown
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

export function rethrowAction<T>(
    actionType: ActionFactory,
): MonoTypeOperatorFunction<T> {
    return function (source) {
        return source.pipe(catchError((e) => throwError(actionType(e))))
    }
}
