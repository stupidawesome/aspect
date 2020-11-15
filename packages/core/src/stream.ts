import { Observable, Observer, PartialObserver, Subject, Subscription } from 'rxjs';
import { AnonymousSubject } from 'rxjs/internal-compatibility';
import { Ref } from './ref';

function addSubscription(sub: Subscription) {
    return sub
}

export class Stream<T, U = T> {
    closed

    private sink

    static from<T>(source: Observable<T> | Ref<T>) {
        return new Stream(source)
    }

    to<V extends U>(sink: ((value: U) => void)): Stream<T, V>
    to<V extends U>(sink: PartialObserver<V>): Stream<T, V>
    to<V extends U>(sink: any): Stream<T, V> {
        sink = typeof sink === "function" ? { next: sink } : sink
        const sub = new Subject()
        sub.subscribe(sink)
        return new Stream<T, V>(this.source, sub)
    }

    subscribe(observer?: (value: U) => void): Subscription
    subscribe(observer?: PartialObserver<U>): Subscription
    subscribe(observer?: any): Subscription {
        if (observer) {
            this.sink.subscribe(observer)
        }
        return addSubscription(this.source.subscribe(this.sink))
    }

    constructor(private source: Observable<T> | Ref<T>, sink?: Observer<T | U>) {
        this.closed = false
        this.sink = new AnonymousSubject<T | U>(sink, source as Observable<T>)
    }
}
