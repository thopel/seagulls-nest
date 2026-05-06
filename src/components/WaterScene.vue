<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, watch } from "vue";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toPath(points, close = false) {
  if (!points.length) {
    return "";
  }

  const first = points[0];
  const last = points[points.length - 1];
  let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    path += ` Q ${previous.x.toFixed(2)} ${previous.y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
  }

  path += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;

  if (close) {
    path += " L 100 100 L 0 100 Z";
  }

  return path;
}

function lerp(start, end, ratio) {
  return start + (end - start) * ratio;
}

const NEST_ASPECT_RATIO = 1162 / 832;
const NEST_AWAKE_SRC = "/assets/seegulls-nest-awake.png";
const NEST_ASLEEP_SRC = "/assets/seegulls-nest-asleep.png";

const props = defineProps({
  skyColor: {
    type: String,
    default: "#8dc9f8",
  },
  waterRatio: {
    type: Number,
    default: 0,
  },
  tiltX: {
    type: Number,
    default: 0,
  },
  tiltY: {
    type: Number,
    default: 0,
  },
  energy: {
    type: Number,
    default: 0.2,
  },
});

const state = reactive({
  level: props.waterRatio,
  levelVelocity: 0,
  gravitySlope: 0,
  gravityVelocity: 0,
  surfaceOffset: 0,
  sloshOffset: 0,
  sloshVelocity: 0,
  bodyDrift: 0,
  bodyVelocity: 0,
  bob: 0,
  bobVelocity: 0,
  rippleAmplitude: 0,
  phase: 0,
  shimmerX: 38,
  nestX: 50,
  nestY: -22,
  nestAngle: 0,
  nestXVelocity: 0,
  nestYVelocity: 0,
  nestAngleVelocity: 0,
  nestSettled: false,
  calmTimer: 0,
  gullsSleeping: false,
});

let frameId = 0;
let previousTime = 0;

const sceneStyle = computed(() => ({
  "--sky-color": props.skyColor,
}));

const waterStyle = computed(() => ({
  "--shell-drift": state.bodyDrift.toFixed(2),
  "--shell-bob": state.bob.toFixed(2),
}));

function buildSurfacePoints(options = {}) {
  const { phaseOffset = 0, amplitudeMultiplier = 1, slopeMultiplier = 1, yOffset = 0 } = options;

  const pointCount = 18;
  const points = [];
  const waterlineBase = 88 - state.level * 78;
  const baseY = waterlineBase + state.bob * 0.28 + yOffset;
  const amplitude = state.rippleAmplitude * amplitudeMultiplier;
  const slope = (state.gravitySlope + state.sloshOffset) * slopeMultiplier;

  for (let index = 0; index <= pointCount; index += 1) {
    const x = (index / pointCount) * 100;
    const centerWeight = Math.sin((x / 100) * Math.PI) ** 0.92;
    const travel = x / 100;
    const longWave = Math.sin(travel * Math.PI + state.phase + phaseOffset) * amplitude * 1.35;
    const shortWave = Math.sin(travel * Math.PI * 2 + state.phase * 0.8 + phaseOffset * 0.6) * amplitude * 0.18;
    const slopeY = ((x - 50) / 50) * slope * 1.18;
    const y = clamp(baseY + slopeY + (longWave + shortWave) * centerWeight, 0, 100);
    points.push({ x, y });
  }

  return points;
}

const frontSurfacePoints = computed(() => buildSurfacePoints());
const backSurfacePoints = computed(() =>
  buildSurfacePoints({
    phaseOffset: 0.9,
    amplitudeMultiplier: 0.56,
    slopeMultiplier: 0.72,
    yOffset: 2.8,
  }),
);

const waterPath = computed(() => toPath(frontSurfacePoints.value, true));
const deepWaterPath = computed(() => toPath(backSurfacePoints.value, true));
const surfacePath = computed(() => toPath(frontSurfacePoints.value));
const isWaterVeryCalm = computed(
  () => state.rippleAmplitude < 0.42 && Math.abs(state.sloshVelocity) < 0.42 && Math.abs(state.sloshOffset) < 1.1 && Math.abs(state.bodyVelocity) < 0.35,
);

function resolveNestTarget(points) {
  const width = 43;
  const height = width / NEST_ASPECT_RATIO;

  if (points.length < 2) {
    return {
      x: 50,
      y: 56,
      width,
      height,
      angle: 0,
    };
  }

  const motionIntensity = clamp(state.rippleAmplitude / 3.8 + Math.abs(state.sloshVelocity) / 6.5 + Math.abs(state.bodyVelocity) / 7, 0, 1);
  const targetX = clamp(
    50 +
      state.surfaceOffset * 0.08 +
      state.bodyDrift * 0.06 +
      state.sloshOffset * 0.08 +
      Math.sin(state.phase * 0.45) * 0.2,
    42,
    58,
  );

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (targetX >= start.x && targetX <= end.x) {
      const span = Math.max(end.x - start.x, 0.0001);
      const ratio = (targetX - start.x) / span;
      const surfaceY = lerp(start.y, end.y, ratio);
      const localAngle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
      const angle = clamp(localAngle * 1.46 + state.sloshVelocity * 0.52, -86, 86);
      const radians = (angle * Math.PI) / 180;
      const calmWaterlineBonus = (1 - motionIntensity) * -0.4;
      const desiredWaterlineRatio = clamp(0.76 + calmWaterlineBonus + motionIntensity * 0.04 + (Math.abs(angle) / 84) * 0.03, 0.76, 0.84);
      const waterlineOffset = (desiredWaterlineRatio - 0.5) * height;
      const normalX = -Math.sin(radians);
      const normalY = Math.cos(radians);
      const baseSink = 1.05;
      const calmSink = baseSink + (1 - motionIntensity) * 1.95;
      const curveFollowOffset = Math.abs(angle / 86) * 0.34;

      return {
        x: targetX - normalX * waterlineOffset,
        y: surfaceY - normalY * waterlineOffset + calmSink + curveFollowOffset,
        width,
        height,
        angle,
      };
    }
  }

  const fallback = points[Math.floor(points.length / 2)];
  const desiredWaterlineRatio = 0.79;
  const waterlineOffset = (desiredWaterlineRatio - 0.5) * height;
  return {
    x: fallback.x,
    y: fallback.y - waterlineOffset + 0.8,
    width,
    height,
    angle: 0,
  };
}

const floatingNestTarget = computed(() => resolveNestTarget(frontSurfacePoints.value));

const floatingNest = computed(() => {
  const target = floatingNestTarget.value;
  if (!target) {
    return null;
  }

  return {
    x: state.nestX,
    y: state.nestY,
    width: target.width,
    height: target.height,
    angle: state.nestAngle,
    href: state.gullsSleeping ? NEST_ASLEEP_SRC : NEST_AWAKE_SRC,
  };
});
const floatingNestStyle = computed(() => {
  if (!floatingNest.value) {
    return null;
  }

  return {
    left: `${floatingNest.value.x}%`,
    top: `${floatingNest.value.y}%`,
    width: `${floatingNest.value.width}%`,
    transform: `translate(-50%, -50%) rotate(${floatingNest.value.angle.toFixed(2)}deg)`,
  };
});

const splashOpacity = computed(() => clamp(state.rippleAmplitude / 8.5, 0, 0.95));

watch(
  () => [props.tiltX, props.tiltY, props.energy],
  (nextValues, previousValues) => {
    const [nextTiltX, nextTiltY, nextEnergy] = nextValues;
    const [previousTiltX = 0, previousTiltY = 0, previousEnergy = 0] = previousValues ?? [];

    const tiltDeltaX = nextTiltX - previousTiltX;
    const tiltDeltaY = nextTiltY - previousTiltY;
    const movementSpeed = Math.sqrt(tiltDeltaX * tiltDeltaX + tiltDeltaY * tiltDeltaY);
    const energyDelta = Math.max(0, nextEnergy - previousEnergy);
    const direction = nextTiltX === 0 ? Math.sign(tiltDeltaX || 1) : Math.sign(nextTiltX);

    state.sloshVelocity += clamp(tiltDeltaX * 10 + tiltDeltaY * 0.8, -7, 7);
    state.bodyVelocity += clamp(tiltDeltaX * 4.5 + direction * energyDelta * 2.2, -5, 5);
    state.bobVelocity += clamp(-tiltDeltaY * 2.2 + energyDelta * 1.2, -2.6, 2.6);

    const motionImpulse = Math.max(0, movementSpeed - 0.003);
    const rippleKick = motionImpulse > 0 ? clamp(motionImpulse * 22 + Math.max(0, nextEnergy - 0.18) * 3.2 + energyDelta * 6.5, 0, 8.5) : 0;

    state.rippleAmplitude = Math.max(state.rippleAmplitude, rippleKick);
  },
  { immediate: true },
);

function tick(timestamp) {
  if (!previousTime) {
    previousTime = timestamp;
  }

  const dt = Math.min((timestamp - previousTime) / 1000, 0.033);
  previousTime = timestamp;

  const levelTarget = clamp(props.waterRatio, 0, 1);
  state.levelVelocity += (levelTarget - state.level) * 2.8 * dt;
  state.levelVelocity *= Math.exp(-3.1 * dt);
  state.level += state.levelVelocity * dt;

  const softenedTilt = Math.sign(props.tiltX) * Math.max(0, Math.abs(props.tiltX) - 0.035) ** 1.18;
  const gravityTarget = clamp(softenedTilt * 96, -96, 96);
  state.gravityVelocity += (gravityTarget - state.gravitySlope) * 5.1 * dt;
  state.gravityVelocity *= Math.exp(-2.55 * dt);
  state.gravitySlope += state.gravityVelocity * dt;

  state.sloshVelocity += -state.sloshOffset * 9.8 * dt;
  state.sloshVelocity *= Math.exp(-2.45 * dt);
  state.sloshOffset += state.sloshVelocity * dt;

  state.surfaceOffset = state.gravitySlope + state.sloshOffset;

  const driftTarget = clamp(-props.tiltX * 5.8 + state.sloshOffset * 0.22, -7, 7);
  state.bodyVelocity += (driftTarget - state.bodyDrift) * 4.8 * dt;
  state.bodyVelocity *= Math.exp(-2.6 * dt);
  state.bodyDrift += state.bodyVelocity * dt;

  const bobTarget = clamp(props.tiltY * -0.8, -1.6, 1.6);
  state.bobVelocity += (bobTarget - state.bob) * 3.8 * dt;
  state.bobVelocity *= Math.exp(-2.5 * dt);
  state.bob += state.bobVelocity * dt;

  state.rippleAmplitude *= Math.exp(-1.55 * dt);
  if (state.rippleAmplitude < 0.01) {
    state.rippleAmplitude = 0;
  }

  if (isWaterVeryCalm.value) {
    state.calmTimer += dt;
    if (state.calmTimer >= 2) {
      state.gullsSleeping = true;
    }
  } else {
    state.calmTimer = 0;
    state.gullsSleeping = false;
  }

  const waveSpeed = state.rippleAmplitude * 0.18 + Math.abs(state.sloshVelocity) * 0.02;
  if (waveSpeed > 0.001) {
    state.phase += waveSpeed * dt * 2.5;
  }
  state.shimmerX = 38 + Math.sin(state.phase * 0.36) * 18 + state.bodyDrift * 0.35;

  const nestTarget = floatingNestTarget.value;
  if (nestTarget) {
    const xSpring = state.nestSettled ? 12.6 : 5.8;
    const xDamping = state.nestSettled ? 4.6 : 3.1;
    const ySpring = state.nestSettled ? 12.8 : 17.2;
    const yDamping = state.nestSettled ? 5.4 : 7.6;
    const angleSpring = state.nestSettled ? 15.4 : 7.8;
    const angleDamping = state.nestSettled ? 5.1 : 3.4;
    const maxLandingOvershoot = 0.14;

    state.nestXVelocity += (nestTarget.x - state.nestX) * xSpring * dt;
    state.nestXVelocity *= Math.exp(-xDamping * dt);
    state.nestX += state.nestXVelocity * dt;

    state.nestYVelocity += (nestTarget.y - state.nestY) * ySpring * dt;
    state.nestYVelocity *= Math.exp(-yDamping * dt);
    state.nestY += state.nestYVelocity * dt;

    if (!state.nestSettled && state.nestY > nestTarget.y + maxLandingOvershoot) {
      state.nestY = nestTarget.y + maxLandingOvershoot;
      state.nestYVelocity = Math.min(state.nestYVelocity, 0.04);
    }

    state.nestAngleVelocity += (nestTarget.angle - state.nestAngle) * angleSpring * dt;
    state.nestAngleVelocity *= Math.exp(-angleDamping * dt);
    state.nestAngle += state.nestAngleVelocity * dt;

    if (!state.nestSettled && Math.abs(nestTarget.y - state.nestY) < 0.55 && Math.abs(state.nestYVelocity) < 1.7) {
      state.nestSettled = true;
    }
  }

  frameId = window.requestAnimationFrame(tick);
}

onMounted(() => {
  frameId = window.requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  window.cancelAnimationFrame(frameId);
});
</script>

<template>
  <div class="scene absolute inset-0" :style="sceneStyle">
    <div class="water-shell" :style="waterStyle">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="water-svg" aria-hidden="true">
        <defs>
          <linearGradient id="water-back-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(220, 255, 255, 0.18)" />
            <stop offset="100%" stop-color="rgba(77, 175, 184, 0.28)" />
          </linearGradient>
        </defs>

        <path class="water-fill-back" :d="deepWaterPath" />
      </svg>

      <img v-if="floatingNest && floatingNestStyle" class="water-float-nest" :src="floatingNest.href" alt="" :style="floatingNestStyle" />

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="water-svg" aria-hidden="true">
        <defs>
          <linearGradient id="water-depth-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(171, 241, 247, 0.36)" />
            <stop offset="18%" stop-color="rgba(118, 213, 226, 0.42)" />
            <stop offset="60%" stop-color="rgba(64, 146, 180, 0.7)" />
            <stop offset="100%" stop-color="rgba(34, 93, 135, 0.92)" />
          </linearGradient>
          <radialGradient id="water-glint-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(255, 255, 255, 0.56)" />
            <stop offset="100%" stop-color="rgba(255, 255, 255, 0)" />
          </radialGradient>
        </defs>

        <path class="water-fill-front" :d="waterPath" />
        <path class="water-surface-shadow" :d="surfacePath" />

        <ellipse class="water-glint" :cx="shimmerX" cy="22" :rx="13 + splashOpacity * 5" :ry="4.8 + splashOpacity * 1.4" />
      </svg>
    </div>
  </div>
</template>
