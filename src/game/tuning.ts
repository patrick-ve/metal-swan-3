/**
 * Gameplay feel and balance constants (docs/ARCHITECTURE.md §6). 60 Hz: speeds in px/tick,
 * times in ticks, damage in "pistol units ×10" (one pistol bullet = 10).
 *
 * Values follow docs/research/mechanics.md §22 "Feel targets" (starting points for
 * play-testing). The gameplay-core agent owns this file; content agents read it and keep their
 * own numbers in their entity definitions.
 *
 * Derived numbers (gravity g = 0.13, jump velocity v = 3.5):
 *   jump apex = v² / 2g ≈ 47 px    air time = 2v / g ≈ 54 ticks (0.9 s)
 */
import { setPhysicsDefaults, type PhysicsDefaults } from '../engine/physics';

export const TUNING = {
  /** Defaults for every physics Body (see engine/physics.ts). */
  physics: {
    gravity: 0.13,
    /** Terminal fall speed: long drops stay fast but readable. */
    maxFall: 4.0,
    /** Steps and bumps up to this height are walked over. */
    stepUp: 4,
    /** Walking keeps ground contact over drops up to this (plus the slope drop). */
    snapDown: 4,
    /** 1:1 slopes (45°) are the steepest walkable ground. */
    maxSlope: 1,
    /** One-way platforms are ignored this long after down + jump. */
    dropThroughTicks: 12,
  } satisfies PhysicsDefaults,

  /** Player movement (mechanics.md §22.1). */
  player: {
    runSpeed: 1.5,
    /** Ground acceleration and braking: full speed in 2 ticks. */
    runAccel: 0.75,
    /** On ice (SectionDef.iceRanges, GDD §11.3): slow to start, slower to stop. */
    iceAccel: 0.1,
    iceDecel: 0.05,
    crawlSpeed: 0.75,
    /** Every jump has the same height (no variable jump). */
    jumpVelocity: -3.5,
    /** Apex hang for standing jumps: gravity × apexHangGravity while |vy| < apexHangVy. */
    apexHangGravity: 0.5,
    apexHangVy: 0.6,
    /** Air control: top speed, acceleration, and the take-off speed multiplier. */
    airMaxSpeed: 2.0,
    airAccel: 0.15,
    takeoffBoost: 1.33,
    /** Jump still allowed this many ticks after walking off a ledge. */
    coyoteTicks: 4,
    /** A jump pressed this many ticks before landing still happens on landing. */
    jumpBufferTicks: 6,
    /** No shot for this long after landing. */
    landFireLockTicks: 2,
    /** Collision body (feet-centre anchor); hitbox 14×30 standing, 16×20 crouching (§6.1). */
    bodyW: 14,
    bodyH: 30,
    crouchBodyW: 16,
    crouchBodyH: 20,
    /** Legs anim speed while running (ticks per frame of the 12-frame cycle at full run speed). */
    runTicksPerFrame: 3,
    /** Players more than this far below the view bottom of an 'up' section fell out. */
    fallOutMargin: 40,
    /**
     * Attachment points used when a sprite frame has none (art still missing):
     * hip relative to the feet, muzzle / hand relative to the hip.
     */
    fallbackHip: [0, -16] as const,
    fallbackHipCrouch: [0, -10] as const,
    fallbackMuzzle: [15, -5] as const,
    fallbackMuzzleUp: [3, -22] as const,
    fallbackMuzzleDown: [3, 12] as const,
    fallbackHand: [9, -15] as const,
    /** Ticks without input before the optional 'bored' fidget plays. */
    boredTicks: 300, // GDD §3.1
    /** Ticks without input before a short idle fidget (fidget-a / fidget-b alternate). */
    fidgetTicks: 150,
  },

  /** Shooting input (mechanics.md §22.2). */
  fire: {
    /** A fire press this early (or during a throw / knife) still fires when ready. */
    bufferTicks: 6,
    /** Tap weapons auto-repeat at this interval while fire is held (comfort for browser play). */
    tapHoldRepeat: 10,
    /** No firing for this long after a special weapon ran dry (the pistol is drawn). */
    drawTicks: 30,
    /** Torso shoot / throw / knife animation speeds. */
    shootAnimTicks: 3,
    throwTicks: 12,
    knifeTicks: 14,
    /**
     * Aim sweep (GDD §4.3, mechanics.md §22): while a `sweep` weapon fires, the aim turns one
     * 22.5° step every `sweepTicks` toward the held direction (forward → up in 8 ticks), so the
     * rounds fired meanwhile fan out through the diagonals.
     */
    sweepStep: Math.PI / 8,
    sweepTicks: 2,
  },

  /** Player weapons (mechanics.md §22.2–22.3). Ammo caps follow §5.1 (999). */
  weapons: {
    maxAmmo: 999,
    pistol: { damage: 10, speed: 8, cooldown: 8, crouchCooldown: 6, maxOnScreen: 16, life: 60 },
    machineGun: {
      damage: 10,
      speed: 9,
      cooldown: 4,
      burst: 4,
      ammo: 200,
      ammoAgain: 150,
      jitter: 1.5,
      life: 60,
    },
    /** Generic vehicle guns (content vehicles may use their own). */
    vulcan: { damage: 10, speed: 9, cooldown: 4, burst: 5, life: 60 },
    cannon: { damage: 200, speed: 5, vy: -1.4, gravity: 0.1, cooldown: 30, life: 180 },
  },

  /** The thrown bomb (mechanics.md §22.4). */
  grenade: {
    perLife: 10,
    cap: 99,
    inAir: 2,
    cooldown: 10,
    vx: 2.1,
    /** Slightly stronger than the reference (−1.5) because our release point is lower (≈ 31 px). */
    vy: -1.8,
    /** Extra take-over of the thrower's horizontal speed. */
    inherit: 1,
    /** Throw arcs when aiming up / down (in the air) and when crouched (GDD §6.1). */
    upVx: 0.8,
    upVy: -3.5,
    downVy: 1.5,
    crouchVx: 2.4,
    crouchVy: -1.2,
    gravity: 0.2,
    bounce: 0.65,
    /** Explodes on this ground contact (2 = after one bounce). */
    contacts: 2,
    fuse: 120,
    /** Direct hit ('explosion' kind) and the blast: 100 to every enemy within r 24, no falloff. */
    direct: 100,
    splash: 100,
    radius: 24,
    falloff: 0,
  },

  /** Automatic melee (mechanics.md §22.5). */
  knife: {
    damage: 30,
    cooldown: 20,
    /** Box in front of the body: width, height (feet up); it starts `overlap` px inside the body. */
    w: 26,
    h: 28,
    crouchH: 20,
    overlap: 6,
  },

  /** Death and respawn (mechanics.md §22.6). */
  life: {
    deathAnimTicks: 60,
    /** Death by a pit: nothing to watch, so respawn sooner (drowning plays die-drown: deathAnimTicks). */
    pitDeathTicks: 40,
    /** Mission-start parachute drop (MissionDef.introDrop): ticks from above the view to the floor (≤ 90, inside the banner). */
    introDropTicks: 80,
    /** Draw-only pick-up flash: white silhouette on ticks 0-1 and 4-5, a white tint fading over ticks 4-9. */
    pickupFlashTicks: 10,
    respawnDropTicks: 12,
    /** Blinking invulnerability after (re)spawning. */
    respawnInvulnTicks: 120,
    respawnBlinkTicks: 2,
    /** Drop-in starts this far above the view top, at this initial fall speed (then +0.4/tick). */
    respawnHeight: 24,
    respawnFallSpeed: 6,
    /** Respawn x is kept this far inside the view edges. */
    respawnEdge: 48,
    livesPerCredit: 3,
  },

  /** Player vehicles (GDD §8.1; content vehicles override most numbers in VehicleOpts). */
  vehicle: {
    cells: 3,
    shells: 10,
    maxShells: 99,
    hitInvulnTicks: 60,
    mountInvulnTicks: 20,
    /** Ticks after an eject before the same player can mount again (and he must land first). */
    remountTicks: 30,
    /** Eject (down + jump): somersault out, 16 + 30 invulnerable ticks. */
    ejectVy: -3.5,
    ejectInvulnTicks: 46,
    /** Thrown out of a destroyed vehicle. */
    destroyedEjectInvulnTicks: 60,
    /** Crush / pit / lava: the pilot is thrown up hard. */
    crushEjectVy: -6,
    /** Ram eject: the pilot pops out upward. */
    ramEjectVy: -4,
    ramEjectInvulnTicks: 60,
    /** A crushed vehicle explodes this long after the pilot was thrown out. */
    wreckTicks: 30,
    /** At 0 cells the pilot has this long to jump out (EASY: thrown out automatically). */
    ejectWindow: 60,
    /** The wreck's blast. */
    wreckDamage: 200,
    wreckRadius: 40,
    /**
     * Combos (GDD §4.1): both buttons need a pressed edge on the same tick or `comboWindow` ticks
     * apart. 1 keeps a quick jump-and-shoot from becoming a ram by accident (3 offsets instead of 9).
     */
    comboWindow: 1,
    ramButtons: ['fire', 'jump'] as const,
    specialButtons: ['fire', 'bomb'] as const,
    /** Ram charge: speed, acceleration, longest run (px / ticks), blast. */
    ramSpeed: 3,
    ramAccel: 0.25,
    ramDistance: 200,
    ramTicks: 150,
    ramDamage: 400,
    ramRadius: 40,
    /** Turret turn speed (radians per tick). */
    turretSpeed: Math.PI / 32,
  },

  /** Items (mechanics.md §12, §13). */
  pickup: {
    magnet: 20,
    magnetSpeed: 1.6,
    bobAmp: 2,
    bobPeriod: 40,
    /**
     * Dropped items vanish after this; they blink during the last `blinkTicks` (GDD §7.1: 720).
     * Pickups read `ITEM_RULES.dropLifetime` (pickup.ts, same value); kept here for reference.
     */
    dropLifetime: 720,
    blinkTicks: 120,
    /** Pop-up speed of a dropped item (GDD §7.1: vy −2.0); enemy drops use it. */
    popVy: -2.0,
  },

  /** Hostages (GDD §7.2): freed stretch, walk to the rescuer, give, bow, run off. */
  hostage: {
    freedTicks: 20,
    walkSpeed: 0.8,
    /** Gives where it stands after this long, or when within `reach` px of the player. */
    walkTicks: 180,
    reach: 16,
    giveTicks: 24,
    bowTicks: 12,
    runSpeed: 2,
  },

  /** Section timer (mechanics.md §11, §22.7): counts shown on the HUD. */
  timer: {
    counts: 60,
    /** One count ≈ 4.3 s, like the reference (a full counter ≈ 4.3 min per checkpoint). */
    ticksPerCount: 256,
    alarmAt: 10,
  },

  /** Continue screen (mechanics.md §22.7). */
  continues: {
    seconds: 10,
    ticksPerCount: 60,
    /** Fire / jump presses skip this many ticks of the countdown. */
    skipTicks: 15,
    /** The continuing player gets this weapon (the reference drops a machine-gun crate). */
    giftWeapon: 'machine-gun',
  },

  /** Scoring (GDD §14). */
  score: {
    enemy: 100,
    /** Knife kills of soft targets score this many times the normal value. */
    knifeMultiplier: 5,
    /** Mission tally (GDD §14.4): per hostage in the tally, and the bonus lines. */
    hostageBonus: 10000,
    ovation: 50000,
    flawless: 30000,
    /** BOSS SPEED BONUS: max(0, 90 − seconds) × 200, at most 18,000. */
    bossSpeedSeconds: 90,
    bossSpeedPerSecond: 200,
    bossSpeedMax: 18000,
    /** VEHICLE AT THE FINISH (riding when the mission boss dies) and NO SCRATCHES. */
    vehicleBossBonus: 100000,
    noScratches: 10000,
    unusablePickup: 1000,
    boss: 20000,
  },

  /** Co-op balance (2 active players). */
  coop: {
    bossHp: 1.5,
    bigEnemyHp: 1.25,
  },

  /** Camera (mechanics.md §22.8); these are also the Camera class defaults. */
  camera: {
    /** Look-ahead: keeps a right-facing player at 40 % of the 384 px view width. */
    lead: 38,
    /** The camera centres this far above the players' feet ('down' sections: show more below). */
    offsetY: 54,
    offsetYDown: -10,
    deadZoneY: 24,
    /** Players are kept this far inside the view edges. */
    margin: 12,
    /** Fraction of the remaining distance moved per tick, and the speed cap (catch-up ≈ 3). */
    smoothing: 0.2,
    maxSpeed: 3,
    /** "GO" arrow appears this long after an arena unlock. */
    goDelay: 30,
    goTicks: 240,
  },

  /** Section transitions. */
  transition: {
    fadeTicks: 30,
    victoryTicks: 210,
  },
};

/** Apply the physics numbers as Body defaults. Call once at boot (browser and headless). */
export function applyTuning(): void {
  setPhysicsDefaults(TUNING.physics);
}
