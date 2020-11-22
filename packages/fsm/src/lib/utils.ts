import { DocumentOrder, ScxmlEvent, StateMode, StateSchema, TransitionSchema } from "./schema"

export function entryOrder(state1: DocumentOrder, state2: DocumentOrder) {
    if (state1.depth < state2.depth) {
        return 1;
    }
    if (state1.depth > state2.depth) {
        return -1;
    }
    return documentOrder(state1, state2);
}

export function documentOrder(state1: DocumentOrder, state2: DocumentOrder) {
    if (state1.documentOrder < state2.documentOrder) {
        return 1;
    }
    if (state1.documentOrder > state2.documentOrder) {
        return -1;
    }
    return 0;
}

export function exitOrder(state1: StateSchema, state2: StateSchema) {
    return entryOrder(state1, state2) * -1;
}

export function isFinalState(state: StateSchema) {
    return state.mode === StateMode.final;
}

export function isSCXMLElement(state: StateSchema | null) {
    return state?.depth === 0;
}

export function isAtomicState(state: StateSchema) {
    return state.atomic;
}

export function conditionMatch(transition: TransitionSchema, context: any) {
    return !transition.cond(context);
}

export function nameMatch(event: string[], name: string) {
    return event.includes(name);
}

export function isCancelEvent(event: any) {
    return event.type === "CANCEL";
}

export function isCompoundStateOrScxmlElement(state: any) {
    return isCompoundState(state) || isSCXMLElement(state);
}


export class Queue {
    queue: any[] = [];

    enqueue(event: any) {
        this.queue.push(event);
    }
    dequeue() {
        return this.queue.shift();
    }
    isEmpty(): boolean {
        return this.queue.length === 0;
    }
}
const noop = () => {};
export class BlockingQueue {
    queue: any[] = [];
    unblock: Function = noop;
    enqueue(event: any) {
        if (this.unblock === noop) {
            this.queue.push(event);
        } else {
            this.unblock(event);
            this.unblock = noop;
        }
    }

    async dequeue(): Promise<ScxmlEvent> {
        if (this.isEmpty()) {
            return new Promise(resolve => {
                this.unblock = resolve;
            });
        } else {
            return this.queue.shift();
        }
    }

    isEmpty(): boolean {
        return this.queue.length === 0;
    }
}
export class OrderedSet<T> extends Set<T> {
    some(predicate: (value: T) => boolean): boolean {
        for (const value of this) {
            if (predicate(value)) {
                return true;
            }
        }
        return false;
    }

    every(predicate: (value: T) => boolean): boolean {
        for (const value of this) {
            if (!predicate(value)) {
                return false;
            }
        }
        return true;
    }

    union(set: Set<T> | { [key: string]: T } | { [key: number]: T}): OrderedSet<T> {
        if (set instanceof Set) {
            set.forEach(value => this.add(value));
        } else {
            Object.values(set as object).forEach(value => this.add(value));
        }

        return this;
    }

    toList(): T[] {
        return Array.from(this);
    }

    hasIntersection(set: Set<T>): boolean {
        for (const value of this) {
            if (set.has(value)) {
                return true;
            }
        }
        return false;
    }

    isEmpty() {
        return this.size === 0;
    }
}

export function isHistoryState(state: StateSchema) {
    return state.mode === StateMode.history;
}
export function isCompoundState(state: StateSchema) {
    return state.descendants.length > 0 && state.mode === StateMode.default;
}

export function isDescendant(state: StateSchema, ancestor?: StateSchema | null): boolean {
    if (state.parent === ancestor) {
        return true;
    } else if (ancestor === null || ancestor === undefined) {
        return false;
    } else {
        return ancestor.descendants.includes(state);
    }
}

export function isParallelState(state: StateSchema) {
    return state.mode === StateMode.parallel;
}

export function getChildStates(state: StateSchema) {
    return state.descendants.filter((childState: any) => childState.parent === state);
}

export function getProperAncestors(state1: StateSchema, state2: StateSchema | null) {
    const anc: StateSchema[] = [];

    if (state2 === null) {
        return state1.ancestors.slice();
    } else if (
        state1.parent === state2 ||
        state1 === state2 ||
        state1.descendants.includes(state2)
    ) {
        return anc;
    } else {
        for (const state of state1.ancestors) {
            if (state !== state2) {
                anc.push(state);
            } else {
                break;
            }
        }
    }
    return anc;
}
