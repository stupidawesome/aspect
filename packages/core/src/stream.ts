import { observable, Observable, Observer, PartialObserver, Subject, Subscription } from 'rxjs';
import { AnonymousSubject } from 'rxjs/internal-compatibility';
import { Ref } from './ref';

function addSubscription(sub: Subscription) {
    return sub
}

export class Stream<T, U = T> {
    closed

    private source: Observable<T>

    static from<T>(source: Observable<T> | Ref<T>) {
        return new Stream(source)
    }

    [observable]() {
        return this
    }

    to<V extends U>(sink: ((value: U) => void)): Stream<T, V>
    to<V extends U>(sink: PartialObserver<V>): Stream<T, V>
    to<V extends U>(sink: any): Stream<T, V> {
        return new Stream<T, V>(this.source, sink)
    }

    subscribe(observer?: (value: U) => void): Subscription
    subscribe(observer?: PartialObserver<U>): Subscription
    subscribe(observer?: any): Subscription {
        return this.source.subscribe(observer)
    }

    constructor(source: Observable<T> | Ref<T>, private sink?: Observer<T | U>) {
        const subject = new Subject<any>()
        const outerSub = new Subscription()
        this.closed = false
        this.source = new Observable(subscriber => {
            const innerSub = subject.subscribe(subscriber)
            if (subject.observers.length === 1) {
                outerSub.add(subject.subscribe(sink))
                outerSub.add(source.subscribe(subject))
            }
            return () => {
                innerSub.unsubscribe()
                if (subject.observers.length === 1) {
                    outerSub.unsubscribe()
                }
            }
        })
    }
}
