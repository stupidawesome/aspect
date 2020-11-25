import { Computed } from './computed';
import { Ref } from './ref';

describe("Computed", () => {
    it("should track parent refs", () => {
        let subject, subject2, expected, expected2, result, result2

        given: expected = { nested: 10 }
        given: expected2 = { nested: 20 }
        given: subject = new Ref({ nested: 0 })
        given: subject2 = new Computed(subject)

        when: subject(expected)

        then: result = subject2.value
        then: expect(result).toEqual(expected)

        when: subject2(expected2)

        then: result = subject()
        then: result2 = subject2.value
        then: expect(result).toEqual(expected)
        then: expect(result2).toEqual(expected2)

        when: subject(expected)

        then: result = subject.value
        then: expect(result).toEqual(expected)

        then: result2 = subject2.value
        then: expect(result2).toEqual(expected)
    })

    it("should compute values", () => {
        let subject: Ref<number>,
            subject2: Computed<number>,
            subject3: Computed<any>,
            expected,
            result

        given: expected = 10 + 10 * 5 - 10
        given: subject = new Ref(1)
        given: subject2 = new Computed(() => {
            return subject() * 5
        })
        given: subject3 = new Computed(() => {
            return subject() + subject2() - 10
        })

        when: subject(10)

        then: result = subject3()
        then: expect(result).toBe(expected)

        when: subject(20)

        then: result = subject3()
        then: expect(result).toBe(20 + 20 * 5 - 10)
    })
})
