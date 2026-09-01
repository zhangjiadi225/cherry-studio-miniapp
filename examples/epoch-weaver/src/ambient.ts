interface Particle {
  x: number
  y: number
  velocityX: number
  velocityY: number
  radius: number
  alpha: number
}

export class AmbientField {
  readonly #canvas: HTMLCanvasElement
  readonly #context: CanvasRenderingContext2D
  readonly #particles: Particle[]
  #animationFrame = 0
  #lastTime = 0
  #running = false

  constructor(canvas: HTMLCanvasElement, particleCount = 72) {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable')
    this.#canvas = canvas
    this.#context = context
    this.#particles = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      velocityX: (Math.random() - 0.5) * 0.002,
      velocityY: 0.001 + Math.random() * 0.003,
      radius: 0.5 + Math.random() * 1.5,
      alpha: 0.12 + Math.random() * 0.42
    }))
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  readonly resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio, 2)
    this.#canvas.width = Math.floor(window.innerWidth * pixelRatio)
    this.#canvas.height = Math.floor(window.innerHeight * pixelRatio)
    this.#canvas.style.width = `${window.innerWidth}px`
    this.#canvas.style.height = `${window.innerHeight}px`
    this.#context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  start() {
    if (this.#running) return
    this.#running = true
    this.#lastTime = performance.now()
    this.#animationFrame = requestAnimationFrame(this.#tick)
  }

  stop() {
    this.#running = false
    cancelAnimationFrame(this.#animationFrame)
  }

  destroy() {
    this.stop()
    window.removeEventListener('resize', this.resize)
  }

  readonly #tick = (time: number) => {
    if (!this.#running) return
    const delta = Math.min((time - this.#lastTime) / 16.67, 3)
    this.#lastTime = time
    this.#draw(delta)
    this.#animationFrame = requestAnimationFrame(this.#tick)
  }

  #draw(delta: number) {
    const width = window.innerWidth
    const height = window.innerHeight
    const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6d5ce7'
    this.#context.clearRect(0, 0, width, height)
    this.#context.fillStyle = color

    for (const particle of this.#particles) {
      particle.x += particle.velocityX * delta
      particle.y -= particle.velocityY * delta
      if (particle.y < -0.02) particle.y = 1.02
      if (particle.x < -0.02) particle.x = 1.02
      if (particle.x > 1.02) particle.x = -0.02

      this.#context.globalAlpha = particle.alpha
      this.#context.beginPath()
      this.#context.arc(particle.x * width, particle.y * height, particle.radius, 0, Math.PI * 2)
      this.#context.fill()
    }
    this.#context.globalAlpha = 1
  }
}
