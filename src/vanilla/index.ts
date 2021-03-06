import { Engine } from './components/engine'
import { EventEmitter, EmblaEvent } from './components/eventEmitter'
import { EventStore } from './components/eventStore'
import { defaultOptions, EmblaOptions } from './components/options'
import {
  addClass,
  arrayFromCollection,
  debounce,
  removeClass,
} from './components/utils'

export type EmblaCarousel = {
  canScrollNext: () => boolean
  canScrollPrev: () => boolean
  clickAllowed: () => boolean
  containerNode: () => HTMLElement
  dangerouslyGetEngine: () => Engine
  destroy: () => void
  off: EventEmitter['off']
  on: EventEmitter['on']
  previousScrollSnap: () => number
  reInit: (options: EmblaOptions) => void
  scrollNext: () => void
  scrollPrev: () => void
  scrollProgress: () => number
  scrollSnapList: () => number[]
  scrollTo: (index: number) => void
  selectedScrollSnap: () => number
  slideNodes: () => HTMLElement[]
  slidesInView: (target?: boolean) => number[]
  slidesNotInView: (target?: boolean) => number[]
}

function EmblaCarousel(
  sliderRoot: HTMLElement,
  userOptions: EmblaOptions = {},
): EmblaCarousel {
  const events = EventEmitter()
  const eventStore = EventStore()
  const debouncedResize = debounce(resize, 500)
  const reInit = reActivate
  const { on, off } = events

  let engine: Engine
  let activated = false
  let options = Object.assign({}, defaultOptions)
  let containerSize = 0
  let container: HTMLElement
  let slides: HTMLElement[]

  activate(userOptions)

  function storeElements(): void {
    if (!sliderRoot) throw new Error('Missing root node 😢')

    const selector = options.containerSelector
    const sliderContainer = sliderRoot.querySelector(selector)

    if (!sliderContainer) throw new Error('Missing container node 😢')

    container = sliderContainer as HTMLElement
    slides = arrayFromCollection(container.children)
  }

  function activate(partialOptions: EmblaOptions = {}): void {
    storeElements()
    options = Object.assign(options, partialOptions)
    engine = Engine(sliderRoot, container, slides, options, events)

    const {
      axis,
      scrollBody,
      translate,
      dragHandler,
      slideLooper,
    } = engine
    const {
      loop,
      draggable,
      draggableClass,
      selectedClass,
      draggingClass,
    } = options

    containerSize = axis.measure(container)
    eventStore.add(window, 'resize', debouncedResize)
    translate.to(scrollBody.location)
    slides.forEach(slideFocusEvent)
    dragHandler.addActivationEvents()

    if (loop) {
      if (!slideLooper.canLoop()) return reActivate({ loop: false })
      slideLooper.loop(slides)
    }
    if (draggable) {
      if (draggableClass) {
        addClass(sliderRoot, draggableClass)
      }
      if (draggingClass) {
        events.on('pointerDown', toggleDraggingClass)
        events.on('pointerUp', toggleDraggingClass)
      }
    } else {
      events.on('pointerDown', dragHandler.removeInteractionEvents)
    }
    if (selectedClass) {
      toggleSelectedClass()
      events.on('select', toggleSelectedClass)
      events.on('pointerUp', toggleSelectedClass)
    }
    if (!activated) {
      setTimeout(() => events.emit('init'), 0)
      activated = true
    }
  }

  function toggleDraggingClass(evt: EmblaEvent): void {
    const { draggingClass } = options
    if (evt === 'pointerDown') addClass(sliderRoot, draggingClass)
    else removeClass(sliderRoot, draggingClass)
  }

  function toggleSelectedClass(): void {
    const { selectedClass } = options
    const inView = slidesInView(true)
    const notInView = slidesNotInView(true)
    notInView.forEach(i => removeClass(slides[i], selectedClass))
    inView.forEach(i => addClass(slides[i], selectedClass))
  }

  function slideFocusEvent(slide: HTMLElement, index: number): void {
    const focus = (): void => {
      const groupIndex = Math.floor(index / options.slidesToScroll)
      const selectedGroup = index ? groupIndex : index
      sliderRoot.scrollLeft = 0
      scrollTo(selectedGroup)
    }
    eventStore.add(slide, 'focus', focus, true)
  }

  function reActivate(partialOptions: EmblaOptions = {}): void {
    const startIndex = engine.index.get()
    const newOptions = Object.assign({ startIndex }, partialOptions)
    deActivate()
    activate(newOptions)
    events.emit('reInit')
  }

  function deActivate(): void {
    const { selectedClass, draggableClass } = options
    engine.dragHandler.removeActivationEvents()
    engine.dragHandler.removeInteractionEvents()
    engine.animation.stop()
    eventStore.removeAll()
    engine.translate.clear()
    engine.slideLooper.clear(slides)
    removeClass(sliderRoot, draggableClass)
    slides.forEach(s => removeClass(s, selectedClass))
    events.off('select', toggleSelectedClass)
    events.off('pointerUp', toggleSelectedClass)
    events.off('pointerDown', toggleDraggingClass)
    events.off('pointerUp', toggleDraggingClass)
  }

  function destroy(): void {
    if (!activated) return
    deActivate()
    activated = false
    engine = {} as Engine
    events.emit('destroy')
  }

  function resize(): void {
    const newContainerSize = engine.axis.measure(container)
    if (containerSize !== newContainerSize) reActivate()
    events.emit('resize')
  }

  function slidesInView(target = false): number[] {
    const location = engine[target ? 'target' : 'location'].get()
    const type = options.loop ? 'removeOffset' : 'constrain'
    return engine.slidesInView.check(engine.limit[type](location))
  }

  function slidesNotInView(target = false): number[] {
    const inView = slidesInView(target)
    return engine.snapIndexes.filter(i => inView.indexOf(i) === -1)
  }

  function scrollSnapList(): number[] {
    const getScrollProgress = engine.scrollProgress.get
    return engine.scrollSnaps.map(getScrollProgress)
  }

  function scrollTo(index: number): void {
    engine.scrollBody.useDefaultMass().useDefaultSpeed()
    engine.scrollTo.index(index, 0)
  }

  function scrollNext(): void {
    const next = engine.index.clone().add(1)
    engine.scrollBody.useDefaultMass().useDefaultSpeed()
    engine.scrollTo.index(next.get(), -1)
  }

  function scrollPrev(): void {
    const prev = engine.index.clone().add(-1)
    engine.scrollBody.useDefaultMass().useDefaultSpeed()
    engine.scrollTo.index(prev.get(), 1)
  }

  function canScrollPrev(): boolean {
    const { index } = engine
    return options.loop || index.get() !== index.min
  }

  function canScrollNext(): boolean {
    const { index } = engine
    return options.loop || index.get() !== index.max
  }

  function scrollProgress(): number {
    const location = engine.location.get()
    return engine.scrollProgress.get(location)
  }

  function selectedScrollSnap(): number {
    return engine.index.get()
  }

  function previousScrollSnap(): number {
    return engine.indexPrevious.get()
  }

  function clickAllowed(): boolean {
    return engine.dragHandler.clickAllowed()
  }

  function dangerouslyGetEngine(): Engine {
    return engine
  }

  function containerNode(): HTMLElement {
    return container
  }

  function slideNodes(): HTMLElement[] {
    return slides
  }

  const self: EmblaCarousel = {
    canScrollNext,
    canScrollPrev,
    clickAllowed,
    containerNode,
    dangerouslyGetEngine,
    destroy,
    off,
    on,
    previousScrollSnap,
    reInit,
    scrollNext,
    scrollPrev,
    scrollProgress,
    scrollSnapList,
    scrollTo,
    selectedScrollSnap,
    slideNodes,
    slidesInView,
    slidesNotInView,
  }
  return self
}

export default EmblaCarousel
