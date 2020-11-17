import { BehaviorSubject, PartialObserver, Subscription } from "rxjs"
import { Callable } from "./callable"

type GetterSetter<T> = (value: T) => T

type UnwrapRefs<T> = {
    [key in keyof T]: T[key] extends Ref<infer R> ? R : T[key]
}

export function copy(obj: any) {
    if (obj instanceof Map) {
        return new Map(obj)
    }
    if (obj instanceof Set) {
        return new Set(obj)
    }
    if (Array.isArray(obj)) {
        return Array.from(obj)
    }
    if (obj instanceof Date) {
        return new Date(obj)
    }
    if (obj instanceof RegExp) {
        return new RegExp(obj)
    }
    if (typeof obj === "object" && obj !== null) {
        return Object.create(
            Object.getPrototypeOf(obj),
            Object.getOwnPropertyDescriptors(obj),
        )
    }
    return obj
}

export function unref<T>(ref: Ref<T> | UnwrapRefs<T> | T): UnwrapRefs<T> {
    const unwrapped = copy(ref instanceof Ref ? ref() : ref as any)
    if (isObject(unwrapped) || Array.isArray(unwrapped)) {
        for (const [key, value] of Object.entries(unwrapped)) {
            if (value instanceof Ref) {
                unwrapped[key] = unref(value)
            }
        }
    }
    return unwrapped
}

function isRef<T extends Ref<any>>(value: unknown | T): value is T {
    return value instanceof Ref
}

function isObject<T extends Object>(value: unknown): value is Object {
    return typeof value === "object" && value !== null
}

type Primitive = string | number | symbol | boolean | bigint | null | undefined

function isPrimitive<T extends Primitive>(value: T | unknown): value is T {
    const type = typeof value
    return value === null || (type !== "object" && type !== "function")
}

type AllowedTypes<T extends Primitive | Object | Array<any> | Set<any> | Map<any, any>> = T | Ref<T> | (() => T)

export interface Ref<T> {
    (): T
    (value: T | Ref<T> | UnwrapRefs<T>): T
    (setter: (value: T) => any): T
}
export class Ref<T> extends Callable<GetterSetter<any>> {
    get value(): UnwrapRefs<T> {
        return this.subject.value
    }
    private ref!: T | Ref<T> | (() => T)
    private readonly subject: BehaviorSubject<UnwrapRefs<T>>

    next(
        value: T | UnwrapRefs<T> | Ref<T> | ((value: UnwrapRefs<T>) => any),
    ): void {
        if (value instanceof Ref) {
            this.setValue(value.value)
        }
        else if (typeof value === "function") {
            const draft = unref(this);

            this.setValue((<any>value)(draft) ?? draft)
        } else {
            this.setValue(unref(value))
        }
    }

    private setValue(unwrappedValue: UnwrapRefs<T>) {
        if (this.ref instanceof Ref) {
            this.subject.next(unwrappedValue)
            return
        }
        if (unwrappedValue instanceof Map) {
            const ref = (this.ref as unknown as Map<any, any>)
            ref.clear()
            for (const [key, value] of unwrappedValue.entries()) {
                ref.set(key, value)
            }
            for (const value of ref.keys()) {
                if (!unwrappedValue.has(value)) {
                    ref.delete(value)
                }
            }
        }
        if (unwrappedValue instanceof Set) {
            const ref = this.ref as unknown as Set<any>
            ref.clear()
            for (const value of unwrappedValue.values()) {
                ref.add(value)
            }
            for (const value of ref.values()) {
                if (!unwrappedValue.has(value)) {
                    ref.delete(value)
                }
            }
        }
        if (isPrimitive(unwrappedValue)) {
            this.ref = unwrappedValue as T
        }
        if (isObject(unwrappedValue) || Array.isArray(unwrappedValue)) {
            const ref = <any>this.ref
            for (const [key, value] of Object.entries(unwrappedValue)) {
                if (ref[key] instanceof Ref) {
                    ref[key].setValue(value)
                } else {
                    ref[key] = value
                }
            }
            for (const key of Object.keys(ref)) {
                if (!unwrappedValue.hasOwnProperty(key) && !(ref[key] instanceof Ref)) {
                    delete ref[key]
                }
            }
        }
        this.subject.next(unwrappedValue)
    }

    subscribe(observer?: (value: T) => void): Subscription
    subscribe(observer?: PartialObserver<T>): Subscription
    subscribe(observer?: any): Subscription {
        return this.subject.subscribe(observer)
    }

    constructor(valueRef: AllowedTypes<T>) {
        super((...value: [T]) => {
            if (value.length > 0) {
                this.next(value[0])
            }
            return this.ref instanceof Function ? this.ref() : this.ref
        })
        this.ref = valueRef
        this.subject = new BehaviorSubject<UnwrapRefs<T>>(unref(this))
    }
}
