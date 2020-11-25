import { EMPTY, identity, isObservable, observable, Observable, UnaryFunction } from 'rxjs';
import { map, switchAll } from "rxjs/operators"
import { Ref } from './ref';

export function maybeSwitch() {
    return function (source: Observable<any>) {
        return source.pipe(
            map((value) => (observable in Object(value) ? value : EMPTY)),
            switchAll(),
        )
    }
}

export function pipeFromArray<T, R>(fns: Array<UnaryFunction<T, R>>): UnaryFunction<T, R> {
    if (fns.length === 0) {
        return identity as UnaryFunction<any, any>;
    }

    if (fns.length === 1) {
        return fns[0];
    }

    return function piped(input: T): R {
        return fns.reduce((prev: any, fn: UnaryFunction<T, R>) => fn(prev), input as any);
    };
}

let refDeps = new Set<Ref<any>>()
let trackingEnabled = false
let previousDeps: Set<Ref<any>>

export function collectDeps() {
    trackingEnabled = true
    previousDeps = refDeps
    refDeps = new Set<Ref<any>>()
}

export function flushDeps() {
    trackingEnabled = false
    const flushed = refDeps
    refDeps = previousDeps
    return flushed
}

export function track(ref: any) {
    if (trackingEnabled) {
        refDeps.add(ref)
    }
}
