import { Observable } from "rxjs"
import { map, switchAll } from "rxjs/operators"

export function maybeSwitch() {
    return function (source: Observable<any>) {
        return source.pipe(
            map((value) => (value instanceof Observable ? value : [value])),
            switchAll(),
        )
    }
}

