import { Component, Directive, Inject, Injectable } from '@angular/core';
import {
    DoCheck,
    ErrorListener,
    Observe, OnContentInit,
    OnInit,
    OnViewInit,
    Ref,
    Stream,
    UseFeatures
} from '@aspect/core';
import {
    Actions,
    createAction,
    createEffect,
    createReducer,
    createStore,
    Dispatcher,
    ofType, STORE_INITIALIZER,
    withEffects,
    withReducers
} from '@aspect/store';
import { of, pipe, throwError } from 'rxjs';
import { delay, map, mapTo, tap } from 'rxjs/operators';
import { createFsm, initial, invoke, state, transition } from '../../../fsm/src/lib/schema';

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

const AppStore = createStore(AppState)

enum FState {}

const interp = createFsm(FState, AppState)

const Machine = interp(
    initial("idle", [
        invoke(appEffects),
        transition(Increment).action(setCount)
    ])
)

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
        Machine
    ],
    // changeDetection: ChangeDetectionStrategy.OnPush
})
@UseFeatures()
export class AppComponent {
    count
    nested
    machine: any

    increment() {
        this.machine.send(Increment(1))
    }

    @DoCheck("count()")
    logCount(previous: number) {
        const { count } = this
        return Stream.from(count.pipe(delay(1000))).to(value => console.log(value))
    }

    @Observe(["count"], { on: delay(1000) })
    observeNested(value: any) {
        // return throwError(new Error("hi"))
    }

    @ErrorListener()
    onError(err: unknown) {
        console.log('error!', err)
    }

    @OnViewInit()
    onInit() {
        console.log('hi init!')
    }

    constructor(state: AppState, private dispatcher: Dispatcher, @Inject(STORE_INITIALIZER) machine: any) {
        this.count = state.count
        this.nested = state.nested
        this.machine = machine[0]

        console.log('machine', machine)

        state.count.subscribe((value) => {
            state.nested(nested => {
                nested.count = value
            })
        })
    }
}
