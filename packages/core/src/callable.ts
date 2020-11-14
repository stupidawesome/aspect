export class Callable<T extends (...args: any[]) => any> extends Function {
    constructor(fn: T) {
        super()
        return Object.setPrototypeOf(fn, new.target.prototype)
    }
}
