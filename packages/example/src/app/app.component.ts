import { ChangeDetectionStrategy, Component, forwardRef } from "@angular/core"
import {
    DoCheck,
    ErrorListener,
    Observe, OnInit,
    OnViewInit,
    Ref,
    Stream,
    UseFeatures,
} from "@aspect/core"
import {
    Actions,
    createAction,
    createEffect,
    createReducer,
    createStore, Dispatch,
    Dispatcher,
    ofType,
} from "@aspect/store"
import { delay, mapTo } from "rxjs/operators"
import {
    createFsm,
    initial,
    invoke, MachineState,
    state,
    transition,
} from "../../../fsm/src/lib/schema"

class AppState {
    count = new Ref(0)
    nested = new Ref({
        count: 0,
    })
}

const Increment = createAction("Increment").withData<number>()
const Multiply = createAction("Multiply").withData<number>()

const reducer = createReducer(AppState)
const setCount = reducer
    .select((data) => data.count)
    .add((count, increment) => count + increment, [Increment])
    .add((count, multiplier) => count * multiplier, [Multiply])

const appEffects = createEffect(Actions).add((actions) => {
    return actions.pipe(ofType(Increment), delay(1000), mapTo(Multiply(2)))
})

const AppStore = createStore(AppState)

enum State {
    idle = "idle",
    loading = "loading",
}

const interp = createFsm(
    State,
    forwardRef(() => AppComponent),
)

const Machine = interp(
    initial(State.idle, [
        invoke(appEffects),
        transition(Increment).action(setCount).to(State.loading),
    ]),
    state(State.loading, [
        invoke(appEffects),
        transition(Increment).action(setCount),
    ]),
)

@Component({
    selector: "aspect-root",
    template: `
        <div>count: {{ count.value }}</div>
        <div>count: {{ count.value }}</div>
        <button (click)="increment()">Increment</button>
    `,
    styleUrls: ["./app.component.css"],
    providers: [Machine],
    changeDetection: ChangeDetectionStrategy.OnPush
})
@UseFeatures()
export class AppComponent {
    count

    increment() {
        this.dispatch(Increment(1))
    }

    @DoCheck("count()")
    logCount(previous: number) {
        const { count } = this
        return Stream.from(count.pipe(delay(1000))).to((value) =>
            console.log(value),
        )
    }

    @Observe(["count"], { on: delay(1000) })
    observeNested(value: any) {
        // return throwError(new Error("hi"))
    }

    @ErrorListener()
    onError(err: unknown) {
        console.log("error!", err)
    }

    @OnInit()
    onInit() {
        console.log("hi init!")
    }

    constructor(private dispatch: Dispatch, private machine: MachineState) {
        this.count = new Ref<number>(0)
        console.log('state', this.machine)
    }
}
