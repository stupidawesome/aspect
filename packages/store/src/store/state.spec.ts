import { fakeAsync, TestBed, tick } from "@angular/core/testing"
import { Ref } from "@aspect/core"
import { map } from "rxjs/operators"
import {
    Actions,
    createAction,
    createEffect,
    createReducer,
    createState,
    createStore,
    Dispatcher,
    ofType,
    State,
    withEffects,
    withReducers,
} from "./store.service"

describe("State", () => {
    it("should create state", () => {
        let subject, expected: Ref<any>, result

        given: expected = new Ref(0)
        given: subject = createState(() => {
            return expected
        })
        given: TestBed.configureTestingModule({
            providers: [createStore(subject)],
        })

        when: result = TestBed.inject(subject)

        then: expect(result).toBe(expected)
    })

    it("should use reducers", () => {
        let TestState, TestAction, expected: number, testReducer, result

        given: TestAction = createAction("TestAction").withData<number>()
        given: expected = 10
        given: TestState = createState(() => new Ref(0))
        given: testReducer = createReducer(TestState).add(
            (state, action) => {
               return action
            },
            [TestAction],
        )
        given: TestBed.configureTestingModule({
            providers: [createStore(TestState, [withReducers(testReducer)])],
        })
        given: result = TestBed.inject(TestState)

        when: TestBed.inject(Dispatcher).dispatch(TestAction(expected))

        then: expect(result()).toBe(expected)
    })

    it("should use nested reducers", () => {
        let TestState, TestAction, expected: number, testReducer, result

        given: TestAction = createAction("TestAction").withData<number>()
        given: expected = 10
        given: TestState = createState(
            () =>
                new Ref({
                    nested: new Ref(0),
                }),
        )
        given: testReducer = createReducer(TestState)
            .select((state) => state().nested)
            .add(
                (state, action) => {
                    return action
                },
                [TestAction],
            )
        given: TestBed.configureTestingModule({
            providers: [createStore(TestState, [withReducers(testReducer)])],
        })
        given: result = TestBed.inject(TestState)

        when: TestBed.inject(Dispatcher).dispatch(TestAction(expected))

        then: expect(result().nested()).toBe(expected)
    })

    it("should use effects", fakeAsync(() => {
        let TestState,
            TestAction: any,
            testEffects,
            expected: number,
            OtherTestAction: any,
            testReducer,
            result

        given: TestAction = createAction("TestAction").withData<number>()
        given: OtherTestAction = createAction("OtherTestAction").withData(
            (num) => num + expected,
        )
        given: expected = 10
        given: TestState = createState(() => new Ref(0))
        given: testEffects = createEffect(Actions, TestState).add((actions) =>
            actions.pipe(
                ofType(TestAction),
                map((action) => action.data),
                map(OtherTestAction),
            ),
        )
        given: testReducer = createReducer(TestState).add(
            (state, action: any) => {
                return action
            },
            [OtherTestAction],
        )
        given: TestBed.configureTestingModule({
            providers: [
                createStore(TestState, [
                    withReducers(testReducer),
                    withEffects(testEffects),
                ]),
            ],
        })
        given: result = TestBed.inject(TestState)

        when: TestBed.inject(Dispatcher).dispatch(TestAction(0))
        when: tick()

        then: expect(result()).toBe(expected)
    }))
})
