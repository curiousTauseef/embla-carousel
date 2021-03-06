import { ScrollLimit } from '../components/scrollLimit'
import { ScrollProgress } from '../components/scrollProgress'

const snapSizes = [80, 80, 80, 80, 80]
const scrollSnaps = [0, -80, -160, -240, -320]
const contentSize = snapSizes.reduce((a, s) => a + s, 0)
const loop = false
const progressMin = 0
const progressMax = 1
const progressHalf = 0.5
const scrollLimit = ScrollLimit({ contentSize, loop })
const limit = scrollLimit.measure(scrollSnaps)
const scrollProgress = ScrollProgress({ limit })
const scrollEnd = limit.min
const scrollStart = limit.max
const scrollHalf = scrollEnd * progressHalf

describe('ScrollProgress', () => {
  describe('Calculates correct progress when given location is', () => {
    test('Max', () => {
      const progress = scrollProgress.get(scrollStart)
      expect(progress).toEqual(-progressMin)
    })

    test('Half', () => {
      const progress = scrollProgress.get(scrollHalf)
      expect(progress).toBe(progressHalf)
    })

    test('Min', () => {
      const progress = scrollProgress.get(scrollEnd)
      expect(progress).toBe(progressMax)
    })
  })
})
