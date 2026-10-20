/**
 * The drivers' lines (docs/design/ring.md §3, §11): short bubbles (≤ 24 characters per line,
 * 2 lines; '\n' breaks the line), English with a Dutch flavour, per squad hero and per event.
 * Never a laugh or a jeer at anyone's misfortune (docs/research/mechanics.md §23): the drivers
 * cheer their own passenger on, grumble at the road and at themselves.
 */

export const DRIVER_EVENTS = [
  'board', 'bump', 'flash', 'hostage', 'low', 'tunnel', 'boss', 'exit', 'arrive',
  // wave B (the enemies' moments; the lorry test boss uses 'boss')
  'scan', 'tow', 'brake', 'caravan', 'roadworks', 'boarder', 'sticker',
] as const;
export type DriverEvent = (typeof DRIVER_EVENTS)[number];

type Lines = Readonly<Record<DriverEvent, readonly string[]>>;

/** Lines per driver id; `default` for any hero without a set of his own. */
export const DRIVER_LINES: Readonly<Record<string, Lines>> = {
  vincent: {
    board: ['STAP IN!\nTHE METER IS RUNNING.'],
    bump: ['THAT DENT IS BILLABLE!', 'HOU JE VAST!'],
    flash: ['NIET WEER EEN FLITSER!', 'EXPENSE THAT FINE.'],
    hostage: ['PASSENGER ON THE ROOF.\nI CHARGE EXTRA.'],
    low: ['DE VOLVO HOUDT HET\nNIET LANG MEER!'],
    tunnel: ['TUNNEL! LIGHTS ON.'],
    boss: ['THAT LORRY IS NOT\nIN MY BUDGET.'],
    exit: ['AFSLAG! INVOICE SENT.'],
    arrive: ['BACK ON THE CLOCK!'],
    scan: ['SCAN CAR! MY PERMIT\nIS IN THE GLOVEBOX.'],
    tow: ['TOWED?! THIS IS A\nBILLABLE HOUR!'],
    brake: ['BRAKE LIGHTS!\nHOU JE VAST!'],
    caravan: ['CARAVAN LOOSE!\nNOT MY INVOICE!'],
    roadworks: ['WEGWERKZAAMHEDEN.\nOVERTIME AGAIN.'],
    boarder: ['GET OFF MY BONNET!'],
    sticker: ['A FINE ON THE GLASS!\nSHAKE IT OFF!'],
  },
  thom: {
    board: ['STAP IN!\nI COMMAND THIS CAR!'],
    bump: ['HOU JE VAST!', 'OUT OF MY WAY,\nPEASANT!'],
    flash: ['FLITSER?! THEY WILL\nNEVER CATCH ME!'],
    hostage: ['HOSTAGE ON THE ROOF!\nHOLD ON TIGHT!'],
    low: ['RETREAT? NEVER!\n...MAYBE A LITTLE.'],
    tunnel: ['TUNNEL! CHARGE!'],
    boss: ['A WORTHY FOE!\nFIRE AT WILL!'],
    exit: ['AFSLAG! VICTORY!'],
    arrive: ['THE EMPEROR RETURNS!'],
    scan: ['THEY DARE SCAN\nTHE EMPEROR?!'],
    tow: ['UNHOOK US, KNAVES!'],
    brake: ['HE BRAKES! SWERVE!'],
    caravan: ['A ROGUE CARAVAN!\nSTAND FAST!'],
    roadworks: ['CONES! CLEAR\nTHE ROYAL ROAD!'],
    boarder: ['A BOARDER! REPEL\nTHE BOARDERS!'],
    sticker: ['A FINE? FOR ME?!\nOUTRAGEOUS!'],
  },
  dirk: {
    board: ['STAP IN!\nMIND THE TOOLBOX.'],
    bump: ['WHO TAUGHT YOU\nTO DRIVE?!', 'HOU JE VAST!'],
    flash: ['NIET WEER EEN FLITSER!'],
    hostage: ['GOT A LEAK UP THERE?\nNO, A HOSTAGE!'],
    low: ['SHE IS LEAKING OIL!\nDUCT TAPE, ANYONE?'],
    tunnel: ['NICE PIPES IN HERE.'],
    boss: ['THAT THING NEEDS\nA BIG WRENCH.'],
    exit: ['AFSLAG! JOB DONE.'],
    arrive: ['FIXED. LET\'S GO!'],
    scan: ['SCAN CAR! KEEP\nMOVING, MATE.'],
    tow: ['THAT HOOK IS ON\nMY BUMPER! SWERVE!'],
    brake: ['BRAKE CHECK! WATCH\nTHE RADIATOR!'],
    caravan: ['LOOSE HITCH!\nBAD WELDING.'],
    roadworks: ['ROAD WORKS. THEY\nNEVER FINISH.'],
    boarder: ['BOOTS OFF MY BONNET!'],
    sticker: ['STICKER ON THE GLASS!\nSCRAPE IT OFF!'],
  },
  bob: {
    board: ['STAP IN! WE CARPOOL\nFOR THE PLANET!'],
    bump: ['SORRY! SORRY!\nHOU JE VAST!'],
    flash: ['FLITSER! I WAS DOING\nTHE ECO SPEED!'],
    hostage: ['A HOSTAGE ON THE ROOF!\nGREEN TRANSPORT!'],
    low: ['DE VOLVO ROOKT!\nCARBON NEUTRAL...?'],
    tunnel: ['TUNNEL! HOLD YOUR\nBREATH!'],
    boss: ['A DIESEL LORRY?!\nTAKE IT DOWN!'],
    exit: ['AFSLAG! I PLANT A TREE.'],
    arrive: ['RECYCLED A VOLVO!'],
    scan: ['A SCAN CAR! WE PAID\nFOR PARKING, RIGHT?'],
    tow: ['NOT THE TOW TRUCK!\nSHE STILL RUNS!'],
    brake: ['HE BRAKES!\nSORRY! SORRY!'],
    caravan: ['A CARAVAN ON THE A10?\nIN THIS ECONOMY?'],
    roadworks: ['NEW CYCLE LANE,\nI HOPE!'],
    boarder: ['PLEASE GET OFF\nTHE BONNET!'],
    sticker: ['A FINE! IS IT\nAT LEAST RECYCLED?'],
  },
  patrick: {
    board: ['STAP IN!\nTHE AI SAYS: DRIVE.'],
    bump: ['BUMP DETECTED.\nHOU JE VAST!'],
    flash: ['FLITSER! I SHOULD\nHAVE CHECKED THE APP.'],
    hostage: ['NEW PASSENGER LOADED\nON THE ROOF RACK.'],
    low: ['ARMOUR LOW!\nTHE AI SAYS: PANIC.'],
    tunnel: ['NO SIGNAL IN HERE!'],
    boss: ['BOSS FIGHT!\nI KNEW IT. SAVE FIRST.'],
    exit: ['AFSLAG! ROUTE DONE.'],
    arrive: ['REBOOTED. GO GO GO!'],
    scan: ['SCAN DETECTED.\nCHANGE LANE.'],
    tow: ['TOW HOOK ATTACHED.\nSWERVE TO DETACH.'],
    brake: ['BRAKE CHECK INCOMING!'],
    caravan: ['CARAVAN UNHITCHED.\nRECALCULATING.'],
    roadworks: ['ROAD WORKS AHEAD.\nTHE APP LIED.'],
    boarder: ['INTRUDER ON THE\nBONNET!'],
    sticker: ['STICKER ON THE GLASS.\nSWERVE TO CLEAR.'],
  },
  default: {
    board: ['STAP IN!\nHOU JE VAST!'],
    bump: ['HOU JE VAST!'],
    flash: ['NIET WEER EEN FLITSER!'],
    hostage: ['HOSTAGE ON THE ROOF!'],
    low: ['DE VOLVO HOUDT HET\nNIET LANG MEER!'],
    tunnel: ['TUNNEL! LIGHTS ON.'],
    boss: ['BIG TROUBLE AHEAD!'],
    exit: ['AFSLAG! WE ZIJN ER.'],
    arrive: ['WE ARE BACK!'],
    scan: ['SCAN CAR!\nCHANGE LANE!'],
    tow: ['TOW HOOK! SWERVE!'],
    brake: ['HE BRAKES!\nHOU JE VAST!'],
    caravan: ['LOOSE CARAVAN!'],
    roadworks: ['WEGWERKZAAMHEDEN!'],
    boarder: ['GET OFF THE BONNET!'],
    sticker: ['A FINE ON THE GLASS!'],
  },
};

/** A driver's line for an event; `pick` (0 … 1) chooses among the variants. */
export function driverLine(driver: string | null, event: DriverEvent, pick = 0): string {
  const set = (driver && DRIVER_LINES[driver]) || DRIVER_LINES.default;
  const list = set[event];
  return list[Math.min(list.length - 1, Math.floor(pick * list.length))];
}

/** Ticks a driver keeps quiet after a line (the boarding, the boss and the exit always talk). */
export const LINE_GAP = 300;
/** Events that talk even inside the gap. */
export const ALWAYS: ReadonlySet<DriverEvent> = new Set<DriverEvent>(['board', 'boss', 'exit']);
