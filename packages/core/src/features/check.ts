import * as objectPath from "object-path"
import { Type } from "@angular/core"
import { isObservable, Observable, ObservableInput, Subject, Subscribable } from "rxjs"
import { filter, switchAll } from "rxjs/operators"

function noop() {}
function wrap(origFn: Function = noop, newFn: Function) {
    return function(this: any) {
        newFn.apply(this)
        origFn?.apply(this)
    }
}


const objectPathWithInheritedProps = objectPath.create({includeInheritedProps: true})

function getCurrentValues(instance: any, props: string[]) {
    return props.map(prop => objectPathWithInheritedProps.get(instance, prop))
}

function checkValues(instance: any, props: string[], method: Function, previousValuesMap: Map<any, any>, processMap: WeakMap<any, Subject<any>>) {
    let changed = false
    const len = props.length
    const previousValues = previousValuesMap.get(method) ?? []
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
        previousValuesMap.set(method, currentValues)
        processMap.get(instance)?.next(method.apply(instance, previousValues))
    }
}

export function createDoCheckFeature(props: string[], descriptor: PropertyDescriptor) {
    return function watchFeature(componentDef: Type<any>): void {
        const previousValuesMap = new Map()
        const processMap = new WeakMap()
        const subscribeMap = new WeakMap()

        props = props.map(prop => prop.replace("()", ".value"))

        componentDef.prototype.ngOnInit = wrap(componentDef.prototype.ngOnInit, function (this: any) {
            const process = new Subject<ObservableInput<any> | unknown>()
            const stream = process.pipe(
                filter((value): value is Subscribable<any> => "subscribe" in Object(value)),
                switchAll()
            )
            processMap.set(this, process)
            subscribeMap.set(this, stream.subscribe())
        })

        componentDef.prototype.ngOnDestroy = wrap(componentDef.prototype.ngOnDestroy, function (this: any) {
            processMap.get(this)?.complete()
            subscribeMap.get(this)?.unsubscribe()
        })

        componentDef.prototype.ngDoCheck = wrap(componentDef.prototype.ngDoCheck, function (this: any) {
            checkValues(this, props, descriptor.value, previousValuesMap, processMap)
        })
    }
}
