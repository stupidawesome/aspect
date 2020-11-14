import { ɵNG_COMP_DEF, ɵNG_DIR_DEF } from '@angular/core';
import { Observable, OperatorFunction, Subject } from 'rxjs';
import { pipeFromArray } from 'rxjs/internal/util/pipe';
import { map, mergeAll } from 'rxjs/operators';
import { ComponentDef } from './interfaces';
import { Reflection } from './reflection';

interface Context {
    [key: string]: any
}

function beginContext() {}

function endContext(context: {}) {}

const refs = new Map()
const previousValues = new Map()
const sinks = new Map()
const processes = new Map()

function doCheck(context: Context) {
    Object.getOwnPropertyNames(context).forEach(propertyKey => {
        const keys: string[] = Reflection.getOwnMetadata(Decorators.Watch, context, propertyKey) ?? []
        for (const key of keys) {
            const ref = refs.get(key)
            const previousValue = previousValues.get(key)
            const currentValue = context[key]
            const method = context[propertyKey]
            const process = processes.get(method)
            if (ref !== currentValue) {
                ref(currentValue())
            }
            if (previousValue !== ref.value) {
                previousValues.set(key, ref.value)
                const returnValue = method()
                if ("subscribe" in returnValue) {
                    process.next(returnValue)
                }
            }
        }
    })
}

function maybeFlatmap() {
    return function (source: Observable<any>) {
        return source.pipe(
            map((value) => value instanceof Observable ? value : [value]),
            mergeAll()
        )
    }
}

function createProcess(context: Context, propertyKey: string) {
    const operators: any[] = Reflection.getOwnMetadata(Decorators.UsePipe, context, propertyKey) ?? []
    const subject = new Subject<Observable<any>>()
    const sink = subject.pipe(
        pipeFromArray(operators),
        maybeFlatmap()
    ).subscribe()

    sinks.get(context).add(sink)
    processes.set(context[propertyKey], subject)
}

function contentCheck(context: {}) {}

function viewCheck(context: {}) {}

function destroy(context: Context) {
    for (const sink of sinks.values()) {
        sink.unsubscribe()
    }
}

function UseFeatures() {
    return function(target: any) {
        const features = []
        const componentDef: ComponentDef<any> = target[ɵNG_COMP_DEF] ?? target[ɵNG_DIR_DEF];

        if (componentDef === undefined) {
            throw new Error('Ivy is not enabled.');
        }

        for (const propertyKey of Reflection.getOwnMetadataProperties(target)) {
            const metakeys = Reflection.getOwnMetadataKeys(target, propertyKey)
            for (const metadataKey of metakeys) {
                const factory = Reflection.getOwnMetadata(metadataKey, target, propertyKey)
                if (factory) {
                    features.push(factory)
                }
            }
        }

        componentDef.features?.push(...features);

        features.forEach(feature => feature(componentDef));
    }
}

const enum Decorators {
    DoCheck = "DoCheck",
    UsePipe = "UsePipe",
    ErrorListener = "ErrorListener",
    OnInit = "OnInit",
    OnViewInit = "OnViewInit",
    OnContentInit = "OnContentInit",
    OnDestroy = "OnDestroy"
}

type Decorator<T extends Array<any>> = (...args: T) => (target: {}, propertyKey: symbol | string) => void
type DecoratorNoParams = () => (target: {}, propertyKey: symbol | string) => void

export function createDecorator(key: string): DecoratorNoParams
export function createDecorator<T extends Array<any> = never[]>(key: string): Decorator<T>
export function createDecorator(key: string): Decorator<unknown[]> {
    return function (...args) {
        return function(target, propertyKey) {
            Reflection.defineMetadata(key, args, target, propertyKey)
        }
    }
}

export const DoCheck = createDecorator<string[]>(Decorators.DoCheck)

export const UsePipe = createDecorator<OperatorFunction<any, unknown>[]>(Decorators.UsePipe)

export const OnInit = createDecorator(Decorators.OnInit)

export const OnViewInit = createDecorator(Decorators.OnViewInit)

export const OnContentInit = createDecorator(Decorators.OnContentInit)

export const OnDestroy = createDecorator(Decorators.OnDestroy)

export const ErrorListener = createDecorator(Decorators.ErrorListener)
