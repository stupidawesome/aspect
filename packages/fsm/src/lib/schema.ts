import { ActionType, Reducer } from "@aspect/store"

export type Schema<T> = Array<
    StateSchema<any> | TransitionSchema | InvokeSchema
>

export function schema<T>(...children: Schema<T>): Schema<any> {
    return children
}

export enum StateMode {
    default = "default",
    parallel = "parallel",
    final = "final",
    history = "history"
}

export interface ScxmlEvent {
    name: string;
    type: "internal" | "external";
    sendId: string | undefined;
    origin: string | undefined;
    originType: string | undefined;
    invokeid: string | undefined;
    data: any;
    target: string;
}

let documentOrder = 0

export interface HistoryValue {
    [key: string]: StateSchema[]
}

export interface HistoryContent {
    [key: string]: Reducer<any, any>[];
}

export class StateSchema<T = any> {
    initial
    mode
    children
    parent: StateSchema
    ancestors: StateSchema[]
    descendants: StateSchema[]
    atomic
    documentOrder
    depth
    transitions: TransitionSchema[]
    invoke: any[]
    onentry: any[]
    onexit: any[]
    history: any[]
    donedata: any

    constructor(public id: string, children: any[], options: any) {
        this.initial = options.initial
        this.mode = options.mode
        this.children = [] as Schema<any>[]
        this.descendants = []
        this.ancestors = []
        this.documentOrder = documentOrder++
        this.parent = this
        this.transitions = []
        this.invoke = []
        this.onentry = []
        this.onexit = []
        this.history = []
        this.donedata = {}

        states.set(id, this)

        for (const child of this.children) {
            if (child instanceof StateSchema) {
                child.parent = this
                child.ancestors.push(this)
                this.descendants.concat(child, child.descendants)
                if (child.mode === StateMode.history) {
                    this.history.push(child)
                }
            }
            if (child instanceof InvokeSchema) {
                this.invoke.push(child)
            }
        }

        this.atomic = this.descendants.length === 0
        this.depth = this.ancestors.length

        for (const child of this.children){
            if (child instanceof TransitionSchema) {
                this.transitions.push(child)
                child.source = this
                child.depth = this.depth
            }
        }
    }
}

export function state<T>(name: string, children: any[]) {
    return new StateSchema<T>(name, children, { mode: StateMode.default })
}

export function initial<T>(name: string, children: any[]) {
    return new StateSchema<T>(name, children, { initial: true, mode: StateMode.default })
}

export function final<T>(name: string, children: any[]) {
    return new StateSchema<T>(name, children, { mode: StateMode.final })
}

export function history<T>(name: string, ...children: any[]) {
    return new StateSchema<T>(name, children, { mode: StateMode.history })
}

const states = new Map()

export class TransitionSchema {
    event: any[]
    cond: Function
    get target(): StateSchema[] {
        return this.targetNames.map(targetName => states.get(targetName))
    }
    actions: Reducer<any, any>[]
    source: StateSchema
    targetNames: string[]
    documentOrder
    depth
    get type(): "internal" | "external" {
        return this.targetNames.length ? "external" : "internal"
    }

    to(...targets: string[]) {
        this.targetNames = targets
        return this
    }

    when(cond: (state: any, action: any) => boolean) {
        this.cond = cond
    }

    action(...actions: Reducer<any, any>[]) {
        this.actions = actions
    }

    constructor(...events: ActionType<any>[]) {
        this.event = events
        this.targetNames = []
        this.actions = []
        this.cond = () => true
        this.source = new StateSchema<any>("", [], {})
        this.documentOrder = documentOrder++
        this.depth = 0
    }
}

export function transition(...actions: ActionType<any>[]) {
    return new TransitionSchema(actions)
}

export class InvokeSchema {
    constructor(public id: string, public src: any, public type = "") {}
}

export function invoke(src: any) {
    return new InvokeSchema(src.name, src)
}

export interface DocumentOrder {
    documentOrder: number
    depth: number
}

export function createFsm(finiteStates: any, dataModel: any) {
    return schema
}

// class State {}
//
// enum FSM {
//     idle = "idle",
//     loading = "loading",
//     nested = "nested",
//     error = "error"
// }

// const MyAction = createAction("MyAction")
// const MyOtherAction = createAction("MyOtherAction")
// const setRoot = createReducer(State)
// const MyEffects = createEffect(Actions, State)
// const interp = createFsm(FSM, State)

// prettier-ignore
// const Machine = interp(
//     initial(FSM.idle, [
//         transition(MyAction)
//             .to(FSM.loading)
//             .action(setRoot),
//         state(FSM.nested, [
//             transition(MyOtherAction)
//                 .to(FSM.error)
//         ])
//     ]),
//     final(FSM.loading, [
//         invoke("MyEffects", MyEffects)
//     ])
// )

