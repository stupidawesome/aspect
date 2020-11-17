import { OperatorFunction } from "rxjs"
import { isArray } from "rxjs/internal-compatibility"
import { createDoCheckFeature } from "./features/check"
import { AspectOptions } from "./interfaces"
import { Reflection } from "./reflection"

export function UseFeatures() {
    return function (target: any) {
        const { prototype } = target
        const features = []

        for (const propertyKey of Reflection.getOwnMetadataProperties(
            prototype,
        )) {
            const metakeys = Reflection.getOwnMetadataKeys(
                prototype,
                propertyKey,
            )
            for (const metadataKey of metakeys) {
                const factory = Reflection.getOwnMetadata(
                    metadataKey,
                    prototype,
                    propertyKey,
                )
                if (factory) {
                    features.push(factory)
                }
            }
        }

        features.forEach((feature) => feature(target))
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

export function DoCheck(paths: string | string[], aspectOptions: AspectOptions = {}): MethodDecorator {
    return function (target, propertyKey, descriptor) {
        Reflection.defineMetadata(Decorators.DoCheck, createDoCheckFeature(isArray(paths) ? paths : [paths], descriptor, aspectOptions), target, propertyKey)
    }
}

export const UsePipe = createDecorator<OperatorFunction<any, unknown>[]>(Decorators.UsePipe)

export const OnInit = createDecorator(Decorators.OnInit)

export const OnViewInit = createDecorator(Decorators.OnViewInit)

export const OnContentInit = createDecorator(Decorators.OnContentInit)

export const OnDestroy = createDecorator(Decorators.OnDestroy)

export const ErrorListener = createDecorator(Decorators.ErrorListener)
