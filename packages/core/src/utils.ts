import { EMPTY, identity, isObservable, Observable, UnaryFunction } from "rxjs"
import { map, switchAll } from "rxjs/operators"

export function maybeSwitch() {
    return function (source: Observable<any>) {
        return source.pipe(
            map((value) => (isObservable(value) ? value : EMPTY)),
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
