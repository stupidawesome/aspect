import * as objectPath from "object-path"
import { ComponentDef } from '../interfaces';

function noop() {}
function wrap(origFn: Function = noop, newFn: Function) {
    return function(this: any) {
        newFn.apply(this)
        origFn.apply(this)
    }
}

function getCurrentValues(instance: any, props: string[]) {
    return props.map(prop => objectPath.get(instance, prop))
}

function checkValues(instance: any, props: string[], method: Function, previousValuesMap: Map) {
    let changed = false
    const len = props.length
    const previousValues = previousValuesMap.get(method)
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
        method.apply(instance, previousValues)
    }
}

function createDoCheckFeature(props: string[], descriptor: PropertyDescriptor) {
    function watchFeature(componentDef: ComponentDef<any>): void {
        const { factory } = componentDef
        const previousValuesMap = new WeakMap()
        componentDef.doCheck = wrap(componentDef.doCheck, function (this: any) {
            checkValues(this, props, descriptor.value, previousValuesMap)
        })
    }
}
