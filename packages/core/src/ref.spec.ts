import { Ref, unref } from "./ref"
import fn = jest.fn

describe("Ref", () => {
    it("should create an instance", () => {
        expect(new Ref(0)).toBeTruthy()
    })

    it("should get primitive values", () => {
        let subject, result

        for (const expected of [1, "1", Symbol(), true, null, undefined]) {
            given: subject = new Ref(expected)
            when: result = subject()
            then: expect(result).toBe(expected)
        }
    })

    it("should not unwrap nested refs", () => {
        let subject, expected, expected2, result, result2

        given: expected2 = 0
        given: expected = new Ref(expected2)
        given: subject = new Ref({
            nested: expected,
        })
        when: result = subject().nested
        when: result2 = result()
        then: expect(result).toBe(expected)
        then: expect(result2).toBe(expected2)
    })

    it("should unwrap nested refs", () => {
        let subject, expected, result

        given: expected = { nested: 0 }
        given: subject = new Ref({
            nested: new Ref(expected.nested),
        })
        when: result = subject.value
        then: expect(result).toEqual(expected)
    })

    it("should set primitive values", () => {
        let subject, result, expected

        given: expected = 10
        given: subject = new Ref(0)
        when: result = subject(expected)
        then: expect(result).toBe(expected)
    })

    it("should subscribe to values", () => {
        let subject, result, expected

        given: expected = 0
        given: result = fn()
        given: subject = new Ref(expected)
        when: subject.subscribe(result)
        then: expect(result).toHaveBeenCalledWith(expected)
    })

    it("should trigger ref", () => {
        let subject, result, values

        given: values = [0, 1]
        given: result = fn()
        given: subject = new Ref(values[0])
        when: subject.subscribe(result)
        when: subject(values[1])
        for (const [nth, expected] of values.entries()) {
            then: expect(result).toHaveBeenNthCalledWith(nth + 1, expected)
        }
    })

    it("should set nested refs", () => {
        let subject, result, expected

        given: expected = new Ref(10)
        given: subject = new Ref({
            nested: new Ref(0),
        })
        when: subject({ nested: expected })
        when: result = subject().nested()
        then: expect(result).toBe(expected())
    })

    it("should set nested refs", () => {
        let subject, result, expected, expected2

        given: expected2 = 10
        given: expected = { nested: new Ref(0) }
        given: subject = new Ref(expected)

        when: subject({ nested: expected2 })
        when: result = subject()

        then: expect(result).toBe(expected)
        then: expect(result.nested()).toBe(expected2)
    })

    it("should trigger nested refs", () => {
        let subject, result, expected, expected2

        given: result = fn()
        given: expected = { nested: 10 }
        given: expected2 = new Ref({ nested: new Ref(20) })
        given: subject = new Ref({
            nested: new Ref(0),
        })

        when: subject.subscribe(result)
        when: subject().nested.subscribe(result)
        when: subject(expected)
        when: subject(expected2)

        then: expect(result).toHaveBeenNthCalledWith(3, expected.nested)
        then: expect(result).toHaveBeenNthCalledWith(4, expected)
        then: expect(result).toHaveBeenNthCalledWith(5, expected2().nested())
        then: expect(result).toHaveBeenNthCalledWith(6, unref(expected2))
    })

    it("should accept setter functions", () => {
        let subject, result, expected: number

        given: expected = 10
        given: subject = new Ref({
            nested: 0,
        })

        when: subject((value) => {
            value.nested = expected
        })
        when: result = subject().nested

        then: expect(result).toBe(expected)
    })

    it("should track parent refs", () => {
        let subject, subject2, expected, expected2, result, result2

        given: expected = { nested: 10 }
        given: expected2 = { nested: 20 }
        given: subject = new Ref({ nested: 0 })
        given: subject2 = new Ref(subject)

        when: subject(expected)

        then: result = subject()
        then: expect(result).toEqual(expected)

        when: subject2(expected2)

        then: result = subject2.value
        then: result2 = subject()
        then: expect(result).toEqual(expected2)
        then: expect(result2).toEqual(expected)
    })

    it("should compute values", () => {
        let subject: Ref<number>,
            subject2: Ref<number>,
            subject3,
            expected,
            result

        given: expected = 10 + 10 * 5 - 10
        given: subject = new Ref(1)
        given: subject2 = new Ref(() => subject() * 5)
        given: subject3 = new Ref(() => subject() + subject2() - 10)

        when: subject(10)

        then: result = subject3()
        then: expect(result).toBe(expected)
    })

    it("should work with arrays", () => {
        let subject, expected, result, values

        given: values = [1, 2, 3]
        given: expected = values.slice()
        given: subject = new Ref(values)

        when: subject(expected.concat(4))
        when: subject((value) => void value.push(5))

        then: result = subject()
        then: expect(result).toBe(values)
        then: expect(result).toEqual([...expected, 4, 5])
    })

    it("should work with maps", () => {
        let subject, expected: [string, number], result, values

        given: values = [
            ["a", 1],
            ["b", 2],
            ["c", 3],
        ] as [string, number][]
        given: expected = ["d", 4]
        given: subject = new Ref(new Map(values))

        when: subject((map) => map.set(expected[0], expected[1]))

        then: result = subject()
        then: expect(result).toEqual(new Map(values.concat([expected])))
    })

    it("should work with sets", () => {
        let subject, expected: number[], result, values

        given: values = [1, 2, 3, 4]
        given: expected = [5, 6]
        given: subject = new Ref(new Set(values))

        when: subject((map) => map.add(expected[0]).add(expected[1]))

        then: result = subject()
        then: expect(result).toEqual(new Set(values.concat(expected)))
    })
})
