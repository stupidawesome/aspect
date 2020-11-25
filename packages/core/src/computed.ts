import {
    BehaviorSubject,
    merge,
    Observable,
    OperatorFunction,
    PartialObserver,
    ReplaySubject,
    Subject,
    Subscription
} from 'rxjs';
import { startWith } from 'rxjs/operators';
import { Callable } from './callable';
import { UnwrapRefs } from './interfaces';
import { Ref } from './ref';
import { collectDeps, flushDeps, pipeFromArray, track } from './utils';

export interface Computed<T> {
    (): T
    (setter: T): T
}
export class Computed<T> extends Callable<any> {
    get value(): T {
        this.computeValue()
        return this.currentValue
    }

    private ref!: (() => T)
    private readonly subject: Subject<T>
    private deps
    private previousValues?: any[]
    private currentValue: any
    private previousValue: any

    private computeValue() {
        const { deps, previousValues } = this
        const currentValues = Array.from(deps).map(ref => ref.value)
        this.previousValues = currentValues
        if (!previousValues || currentValues.some((val, index) => val !== previousValues[index])) {
            collectDeps()
            this.currentValue = (<Function>this.ref)()
            this.deps = flushDeps()
        }
        if (this.currentValue !== this.previousValue) {
            this.previousValue = this.currentValue
            this.subject.next(this.currentValue)
        }
    }

    pipe(): Observable<T>;
    pipe<A>(op1: OperatorFunction<T, A>): Observable<A>;
    pipe<A, B>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): Observable<B>;
    pipe<A, B, C>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>): Observable<C>;
    pipe<A, B, C, D>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>): Observable<D>;
    pipe<A, B, C, D, E>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>): Observable<E>;
    pipe<A, B, C, D, E, F>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>): Observable<F>;
    pipe<A, B, C, D, E, F, G>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>): Observable<G>;
    pipe<A, B, C, D, E, F, G, H>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>): Observable<H>;
    pipe<A, B, C, D, E, F, G, H, I>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>): Observable<I>;
    pipe<A, B, C, D, E, F, G, H, I>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>, ...operations: OperatorFunction<any, any>[]): Observable<{}>;

    pipe(...operators: any[]) {
        return this.subject.asObservable().pipe(pipeFromArray(operators))
    }

    subscribe(observer?: (value: T) => void): Subscription
    subscribe(observer?: PartialObserver<T>): Subscription
    subscribe(observer?: any): Subscription {
        this.computeValue()
        return this.subject.subscribe(observer)
    }

    constructor(setter: () => T) {
        super((...value: [T]) => {
            track(this)
            if (value.length > 0) {
                this.subject.next(value[0])
                this.currentValue = value[0]
                return value[0]
            }
            return this.value
        })
        this.ref = setter
        this.deps = setter instanceof Ref ? new Set<any>([setter]) : new Set<any>()
        this.subject = new ReplaySubject<T>(1)
    }
}
