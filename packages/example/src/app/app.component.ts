import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from "@angular/core"
import { DoCheck, Ref, UseFeatures } from "@aspect/core"
import {
    Actions,
    createAction,
    createEffect,
    createReducer,
    createStore,
    Dispatcher,
    ofType,
    withEffects,
    withReducers,
} from "@aspect/store"
import { concatAll, delay, map, mapTo, tap } from "rxjs/operators"
import { from, of } from "rxjs"

class AppState {
    count = new Ref(0)
    nested = new Ref({
        count: 0
    })
}

const Increment = createAction("Increment").withData<number>()
const Multiply = createAction("Multiply").withData<number>()

const reducer = createReducer(AppState)
const setCount = reducer
    .select(state => state.count)
    .add((count, increment) => count + increment, [Increment])
    .add((count, multiplier) => count * multiplier, [Multiply])

const appEffects = createEffect(Actions)
    .add((actions) => {
        return actions.pipe(
            ofType(Increment),
            delay(1000),
            mapTo(Multiply(2)),
        )
    })

const AppStore = createStore(AppState, [
    withReducers(setCount),
    withEffects(appEffects),
])

@Component({
    selector: "aspect-root",
    template: `
        <div>count: {{ count.value }}</div>
        <div>count: {{ count.value }}</div>
        <button (click)="increment()">Increment</button>
    `,
    styleUrls: ["./app.component.css"],
    providers: [
        AppStore,
    ],
    // changeDetection: ChangeDetectionStrategy.OnPush
})
@UseFeatures()
export class AppComponent {
    count
    nested

    increment() {
        this.dispatcher.dispatch(Increment(1))
    }

    @DoCheck("nested().count", { on: delay(1000) })
    logCount(previous: number) {
        console.log('hi?', previous, this.nested().count)
        return of(1, 2, 3).pipe(
            tap(a => console.log('test', a))
        )
    }

    constructor(state: AppState, private dispatcher: Dispatcher) {
        this.count = state.count
        this.nested = state.nested

        state.count.subscribe((value) => {
            state.nested(nested => {
                nested.count = value
            })
        })
    }
}
