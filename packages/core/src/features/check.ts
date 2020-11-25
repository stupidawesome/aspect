import { Type } from "@angular/core"
import * as objectPath from "object-path"
import { identity, isObservable, Observable, observable, ObservableInput, Subject, Subscribable } from 'rxjs';
import { catchError, distinctUntilChanged, filter, switchAll, tap } from 'rxjs/operators';
import { AspectOptions } from "../interfaces"
import { maybeSwitch } from "../utils"

function noop() {}
export function wrap(origFn: Function = noop, newFn: Function) {
    return function(this: any, ...args: any[]) {
        newFn.apply(this, args)
        origFn?.apply(this, args)
    }
}


const objectPathWithInheritedProps = objectPath.create({includeInheritedProps: true})

function getCurrentValues(instance: any, props: string[]) {
    return props.map(prop => objectPathWithInheritedProps.get(instance, prop))
}

function checkValues(instance: any, props: string[], method: Function, previousValuesMap: WeakMap<any, any>, processMap: WeakMap<any, any>) {
    let changed = false
    const len = props.length
    const previousValues = previousValuesMap.get(instance) ?? []
    const currentValues = getCurrentValues(instance, props)
    for (let i=0; i < len; i++) {
        const previousValue = previousValues[i]
        const currentValue = currentValues[i]
        if (previousValue !== currentValue) {
            changed = true
            break
        }
    }
    if (changed) {
        previousValuesMap.set(instance, currentValues)
        processMap.get(instance)?.next(method.apply(instance, previousValues))
    }
}

function isSubscribable(value: any): value is Subscribable<any> {
    return observable in Object(value)
}

function processOp(options: any, errorMap: any, context: any) {
    return function (source: Observable<any>) {
        return source.pipe(
            filter(isSubscribable),
            options.on ?? identity,
            maybeSwitch(),
            catchError((e, caught) => {
                errorMap.get(context).next(e)
                return caught
            })
        )
    }
}

export function createCheckFeature(props: string[], descriptor: PropertyDescriptor, options: AspectOptions, lifecycleKey: string) {
    return function watchFeature(componentDef: Type<any>, errorMap: WeakMap<any, any>): void {
        const previousValuesMap = new WeakMap()
        const processMap = new WeakMap()
        const subscribeMap = new WeakMap()

        props = props.map(prop => prop.replace("()", ".value"))

        componentDef.prototype.ngOnInit = wrap(componentDef.prototype.ngOnInit, function (this: any) {
            const process = new Subject<ObservableInput<any> | unknown>()
            const stream = process.pipe(processOp(options, errorMap, this))
            processMap.set(this, process)
            subscribeMap.set(this, stream.subscribe())
        })

        componentDef.prototype.ngOnDestroy = wrap(componentDef.prototype.ngOnDestroy, function (this: any) {
            processMap.get(this)?.complete()
            subscribeMap.get(this)?.unsubscribe()
        })

        componentDef.prototype[lifecycleKey] = wrap(componentDef.prototype[lifecycleKey], function (this: any) {
            checkValues(this, props, descriptor.value, previousValuesMap, processMap)
        })
    }
}

export function createObserveFeature(props: string[], descriptor: PropertyDescriptor, options: AspectOptions) {
    return function watchFeature(componentDef: Type<any>, errorMap: WeakMap<any, any>): void {
        const processMap = new WeakMap()
        const subscribeMap = new WeakMap()

        props = props.map(prop => prop.replace("()", ".value"))

        componentDef.prototype.ngOnInit = wrap(componentDef.prototype.ngOnInit, function (this: any) {
            const process = new Subject<ObservableInput<any> | unknown>()
            const stream = process.pipe(processOp(options, errorMap, this))
            processMap.set(this, process)
            subscribeMap.set(this, stream.subscribe())
            for (const prop of props) {
                this[prop].pipe(distinctUntilChanged()).subscribe((value: unknown) => {
                    process.next(descriptor.value.call(this, value))
                })
            }
        })

        componentDef.prototype.ngOnDestroy = wrap(componentDef.prototype.ngOnDestroy, function (this: any) {
            processMap.get(this)?.complete()
            subscribeMap.get(this)?.unsubscribe()
        })
    }
}

export function createErrorFeature(descriptor: PropertyDescriptor, options: AspectOptions) {
    return function errorFeature(componentDef: Type<any>, errorMap: WeakMap<any, any>): void {
        const processMap = new WeakMap()
        const subscribeMap = new WeakMap()

        componentDef.prototype.ngOnInit = wrap(componentDef.prototype.ngOnInit, function (this: any) {
            const process = new Subject<ObservableInput<any> | unknown>()
            const stream = process.pipe(
                filter((value): value is Subscribable<any> => "subscribe" in Object(value)),
                options.on ?? identity,
                maybeSwitch()
            )
            processMap.set(this, process)
            subscribeMap.set(this, stream.subscribe())
            errorMap.get(this).subscribe((value: unknown) => {
                process.next(descriptor.value.call(this, value))
            })
        })

        componentDef.prototype.ngOnDestroy = wrap(componentDef.prototype.ngOnDestroy, function (this: any) {
            processMap.get(this)?.complete()
            subscribeMap.get(this)?.unsubscribe()
        })
    }
}

export function createInitFeature(descriptor: PropertyDescriptor, options: AspectOptions, lifecycleKey: string) {
    return function initFeature(componentDef: Type<any>, errorMap: WeakMap<any, any>): void {
        const processMap = new WeakMap()
        const subscribeMap = new WeakMap()

        componentDef.prototype[lifecycleKey] = wrap(componentDef.prototype[lifecycleKey], function (this: any) {
            const process = new Subject<ObservableInput<any> | unknown>()
            const stream = process.pipe(processOp(options, errorMap, this))
            processMap.set(this, process)
            subscribeMap.set(this, stream.subscribe())
            process.next(descriptor.value.call(this))
        })

        componentDef.prototype.ngOnDestroy = wrap(componentDef.prototype.ngOnDestroy, function (this: any) {
            processMap.get(this)?.complete()
            subscribeMap.get(this)?.unsubscribe()
        })
    }
}
