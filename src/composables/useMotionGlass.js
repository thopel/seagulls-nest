import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function useMotionGlass() {
  const tiltX = ref(0)
  const tiltY = ref(0)
  const energy = ref(0.18)
  const enabled = ref(false)
  const supported = ref(false)
  const permissionState = ref('idle')

  let motionTimer = null
  let lastSensorTimestamp = 0
  let lastGravityTimestamp = 0
  let orientationBaselineBeta = null
  let orientationBaselineGamma = null

  const hasMotionSupport = () => typeof window !== 'undefined' && typeof DeviceMotionEvent !== 'undefined'
  const hasOrientationSupport = () => typeof window !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined'

  const resetOrientationBaseline = () => {
    orientationBaselineBeta = null
    orientationBaselineGamma = null
  }

  const getScreenAngle = () => {
    if (typeof window === 'undefined') {
      return 0
    }

    if (typeof window.screen?.orientation?.angle === 'number') {
      return window.screen.orientation.angle
    }

    if (typeof window.orientation === 'number') {
      return window.orientation
    }

    return 0
  }

  const mapAxesToScreen = (primaryX, primaryY, divisorX = 1, divisorY = 1) => {
    const angle = ((getScreenAngle() % 360) + 360) % 360

    if (angle === 90) {
      return {
        x: clamp(primaryY / divisorX, -1, 1),
        y: clamp(-primaryX / divisorY, -1, 1)
      }
    }

    if (angle === 270) {
      return {
        x: clamp(-primaryY / divisorX, -1, 1),
        y: clamp(primaryX / divisorY, -1, 1)
      }
    }

    if (angle === 180) {
      return {
        x: clamp(-primaryX / divisorX, -1, 1),
        y: clamp(-primaryY / divisorY, -1, 1)
      }
    }

    return {
      x: clamp(primaryX / divisorX, -1, 1),
      y: clamp(primaryY / divisorY, -1, 1)
    }
  }

  const applyTilt = (nextX, nextY, smoothing = 0.18) => {
    tiltX.value += (nextX - tiltX.value) * smoothing
    tiltY.value += (nextY - tiltY.value) * smoothing
  }

  const applyEnergy = (nextEnergy, smoothing = 0.2) => {
    energy.value += (nextEnergy - energy.value) * smoothing
  }

  const registerMotionListener = () => {
    if (enabled.value) {
      return true
    }

    window.addEventListener('devicemotion', handleMotion, { passive: true })
    window.addEventListener('deviceorientation', handleOrientation, { passive: true })
    enabled.value = true
    permissionState.value = 'granted'
    return true
  }

  const settleEnergy = () => {
    window.clearTimeout(motionTimer)
    motionTimer = window.setTimeout(() => {
      applyEnergy(0.18, 0.3)
    }, 260)
  }

  const markActive = () => {
    lastSensorTimestamp = Date.now()
    settleEnergy()
  }

  const handleMotion = (event) => {
    const rotation = event.rotationRate ?? {}
    const acceleration = event.accelerationIncludingGravity ?? event.acceleration ?? {}
    const gravityX = typeof acceleration.x === 'number' ? acceleration.x : 0
    const gravityY = typeof acceleration.y === 'number' ? acceleration.y : 0
    const gravityZ = typeof acceleration.z === 'number' ? acceleration.z : 0
    const gravityMagnitude = Math.max(
      1,
      Math.sqrt(gravityX * gravityX + gravityY * gravityY + gravityZ * gravityZ)
    )
    const { x: nextTiltX, y: nextTiltY } = mapAxesToScreen(
      gravityX,
      gravityY,
      gravityMagnitude,
      gravityMagnitude
    )
    const agitation = Math.min(
      1,
      (Math.abs(rotation.alpha ?? 0) + Math.abs(rotation.beta ?? 0) + Math.abs(rotation.gamma ?? 0)) / 240
    )

    applyTilt(nextTiltX, nextTiltY, 0.22)
    applyEnergy(clamp(0.18 + agitation, 0.18, 1), 0.22)
    lastGravityTimestamp = Date.now()
    markActive()
  }

  const handleOrientation = (event) => {
    const gamma = typeof event.gamma === 'number' ? event.gamma : null
    const beta = typeof event.beta === 'number' ? event.beta : null

    if (gamma === null && beta === null) {
      return
    }

    if (orientationBaselineGamma === null && gamma !== null) {
      orientationBaselineGamma = gamma
    }

    if (orientationBaselineBeta === null && beta !== null) {
      orientationBaselineBeta = beta
    }

    if (Date.now() - lastGravityTimestamp < 180) {
      markActive()
      return
    }

    const relativeGamma = (gamma ?? orientationBaselineGamma ?? 0) - (orientationBaselineGamma ?? 0)
    const relativeBeta = (beta ?? orientationBaselineBeta ?? 0) - (orientationBaselineBeta ?? 0)
    const { x: nextTiltX, y: nextTiltY } = mapAxesToScreen(relativeGamma, relativeBeta, 30, 40)

    applyTilt(nextTiltX, nextTiltY, 0.18)

    const orientationEnergy = clamp(
      0.18 + (Math.abs(relativeGamma) + Math.abs(relativeBeta)) / 260,
      0.18,
      0.5
    )

    if (Date.now() - lastSensorTimestamp > 140) {
      applyEnergy(orientationEnergy, 0.14)
    }

    markActive()
  }

  const handlePointer = (event) => {
    if (enabled.value || !window.innerWidth) {
      return
    }

    const offsetX = event.clientX / window.innerWidth - 0.5
    const offsetY = event.clientY / window.innerHeight - 0.5
    applyTilt(clamp(offsetX * 1.2, -0.75, 0.75), clamp(offsetY * 1.2, -0.75, 0.75), 0.24)
    applyEnergy(0.28, 0.24)
  }

  const requestMotionAccess = async () => {
    if (typeof window === 'undefined' || (!hasMotionSupport() && !hasOrientationSupport())) {
      permissionState.value = 'unsupported'
      return false
    }

    supported.value = true

    const requests = []

    if (hasMotionSupport() && typeof DeviceMotionEvent.requestPermission === 'function') {
      requests.push(DeviceMotionEvent.requestPermission())
    }

    if (hasOrientationSupport() && typeof DeviceOrientationEvent.requestPermission === 'function') {
      requests.push(DeviceOrientationEvent.requestPermission())
    }

    if (requests.length) {
      const responses = await Promise.allSettled(requests)
      const granted = responses.some(
        (entry) => entry.status === 'fulfilled' && entry.value === 'granted'
      )

      permissionState.value = granted ? 'granted' : 'denied'
      if (!granted) {
        return false
      }
    }

    return registerMotionListener()
  }

  onMounted(() => {
    supported.value = hasMotionSupport() || hasOrientationSupport()
    window.addEventListener('pointermove', handlePointer, { passive: true })
    window.addEventListener('orientationchange', resetOrientationBaseline, { passive: true })

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', resetOrientationBaseline)
    }

    if (!supported.value) {
      permissionState.value = 'unsupported'
      return
    }

    if (
      (hasMotionSupport() && typeof DeviceMotionEvent.requestPermission === 'function') ||
      (hasOrientationSupport() && typeof DeviceOrientationEvent.requestPermission === 'function')
    ) {
      permissionState.value = 'prompt'
      return
    }

    requestMotionAccess()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('devicemotion', handleMotion)
    window.removeEventListener('deviceorientation', handleOrientation)
    window.removeEventListener('pointermove', handlePointer)
    window.removeEventListener('orientationchange', resetOrientationBaseline)

    if (window.screen?.orientation) {
      window.screen.orientation.removeEventListener('change', resetOrientationBaseline)
    }

    window.clearTimeout(motionTimer)
  })

  return {
    tiltX,
    tiltY,
    energy,
    enabled,
    supported: computed(() => supported.value),
    permissionState,
    requestMotionAccess
  }
}
