const metadata = new WeakMap<{}, Map<any, Map<any, any>>>()

function safeGetMap(map: WeakMap<any, any>, key: any) {
    return map.get(key) ?? map.set(key, new Map()).get(key)
}

export class Reflection {
    static defineMetadata(metadataKey: string | symbol | number, metadataValue: unknown, target: {}, propertyKey?: string | symbol) {
        const targetMetadata = safeGetMap(metadata, target)
        const propMetadata = safeGetMap(targetMetadata, propertyKey)
        propMetadata.set(metadataKey, metadataValue)
    }
    static getOwnMetadata(metadataKey: string | symbol, target: {}, propertyKey?: string | symbol) {
        return metadata.get(target)?.get(propertyKey)?.get(metadataKey)
    }

    static getOwnMetadataKeys(target: {}, propertyKey?: string | symbol) {
        return metadata.get(target)?.get(propertyKey)?.keys() ?? []
    }

    static getOwnMetadataProperties(target: any) {
        return metadata.get(target)?.keys() ?? []
    }

    static hasOwnMetadata(metadataKey: unknown, target: {}, propertyKey?: string | symbol) {
        return metadata.get(target)?.get(propertyKey)?.has(metadataKey) ?? false
    }
}
