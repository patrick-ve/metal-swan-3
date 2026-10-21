/**
 * The drivers' lines (docs/design/ring.md §3, §11): short bubbles (≤ 24 characters per line,
 * 2 lines; '\n' breaks the line), English with a Dutch flavour, per squad hero and per event.
 * Never a laugh or a jeer at anyone's misfortune (docs/research/mechanics.md §23): the drivers
 * cheer their own passenger on, grumble at the road and at themselves. No real person is named or
 * insulted. The wave-B moments (scan, tow, sticker, brake, boarder) carry the way out in the line
 * (change lane, swerve, shoot the cable, the knife) so a line doubles as a hint.
 *
 * Each driver has his own voice (docs/design/squad.md):
 * - vincent — the overpriced consultant: everything is billable, there is always a plan.
 * - thom — the little emperor: commands, charges, outrage at any fine.
 * - dirk — the plumber: pipes, leaks, wrenches, a fair day's work.
 * - bob — the climate saver who flies a lot: sorry, offsets, trees, the airport.
 * - patrick — the AI nerd: logs, models, apps, reboots and frikandellen.
 *
 * `flash` and `boss` keep ONE line per driver: tests/game/ring/boarding.test.ts compares the
 * bubble with `driverLine(id, event)` (variant 0) while `say` picks with the fx rng.
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
    board: ['STAP IN!\nTHE METER IS RUNNING.', 'STAP IN! I HAVE A PLAN.\nSLIDE 1: DRIVE.'],
    bump: ['THAT DENT IS BILLABLE!', 'HOU JE VAST!\nCOST CENTRE: BUMPER.'],
    flash: ['NIET WEER EEN FLITSER!\nEXPENSE IT.'],
    hostage: ['PASSENGER ON THE ROOF.\nI CHARGE EXTRA.', 'ROOF SEAT TAKEN.\nPREMIUM RATE.'],
    low: ['DE VOLVO HOUDT HET\nNIET LANG MEER!', 'ARMOUR BELOW TARGET.\nNEW PLAN: SURVIVE.'],
    tunnel: ['TUNNEL! LIGHTS ON,\nMETER STILL RUNNING.', 'DARK IN HERE.\nGOOD FOR THE MARGINS.'],
    boss: ['BIG TARGET AHEAD.\nPLAN A: SHOOT IT.'],
    exit: ['AFSLAG! INVOICE SENT.', 'AFSLAG! PROJECT CLOSED.'],
    arrive: ['BACK ON THE CLOCK!', 'NEW VOLVO. SAME PLAN.'],
    scan: ['SCAN CAR! MY PERMIT\nIS IN THE GLOVEBOX.', 'SCAN LOCK! OUT OF\nTHAT LANE, PRONTO!'],
    tow: ['A TOW HOOK?! SWERVE,\nOR SHOOT THE CABLE!', 'TOWED?! THAT IS NOT\nIN THE CONTRACT!'],
    brake: ['BRAKE LIGHTS!\nHE WILL STOP DEAD!', 'BRAKE CHECK! I SAW\nTHAT IN THE FORECAST.'],
    caravan: ['CARAVAN LOOSE!\nNOT MY INVOICE!', 'WIE PARKEERT ER\nEEN CARAVAN?!'],
    roadworks: ['WEGWERKZAAMHEDEN.\nOVERTIME AGAIN.', 'CONES! THEY BILL\nBY THE CONE.'],
    boarder: ['GET OFF MY BONNET!', 'NO FREE RIDES!\nTHIS IS A PAID SEAT.'],
    sticker: ['A FINE ON THE GLASS!\nSWERVE IT OFF!', 'STICKER ON MY VIEW.\nSWERVE TO SHAKE IT.'],
  },
  thom: {
    board: ['STAP IN!\nI COMMAND THIS CAR!', 'STAP IN! FORWARD!\nTHE EMPIRE AWAITS!'],
    bump: ['HOU JE VAST!', 'MAKE WAY FOR\nTHE EMPEROR!'],
    flash: ['FLITSER?! THEY WILL\nNEVER CATCH ME!'],
    hostage: ['HOSTAGE ON THE ROOF!\nHOLD ON TIGHT!', 'A NEW RECRUIT\nON THE ROOF!'],
    low: ['RETREAT? NEVER!\n...MAYBE A LITTLE.', 'MY CHARIOT BURNS!\nFIGHT ON!'],
    tunnel: ['TUNNEL! CHARGE!', 'INTO THE DARK!\nEN AVANT!'],
    boss: ['A WORTHY FOE!\nFIRE AT WILL!'],
    exit: ['AFSLAG! VICTORY!', 'AFSLAG! WRITE THIS\nIN THE HISTORY BOOKS!'],
    arrive: ['THE EMPEROR RETURNS!', 'A NEW CHARIOT!\nCHARGE!'],
    scan: ['THEY DARE SCAN\nTHE EMPEROR?!', 'SCAN LOCK! BREAK\nFORMATION, NOW!'],
    tow: ['UNHOOK US, KNAVES!', 'A HOOK! SWERVE OR\nSHOOT THE CABLE!'],
    brake: ['HE BRAKES! SWERVE!', 'A TRAP! BRAKE\nLIGHTS AHEAD!'],
    caravan: ['A ROGUE CARAVAN!\nSTAND FAST!', 'THE CARAVAN BREAKS\nRANKS! DODGE!'],
    roadworks: ['CONES! CLEAR\nTHE ROYAL ROAD!', 'WHO BLOCKS MY ROAD?\nROAD WORKS?!'],
    boarder: ['A BOARDER! REPEL\nTHE BOARDERS!', 'OFF MY CHARIOT,\nSCOUNDREL!'],
    sticker: ['A FINE? FOR ME?!\nOUTRAGEOUS!', 'I PARDON MYSELF!\nSHAKE IT OFF!'],
  },
  dirk: {
    board: ['STAP IN!\nMIND THE TOOLBOX.', 'STAP IN! I BROUGHT\nTHE BIG WRENCH.'],
    bump: ['WHO TAUGHT YOU\nTO DRIVE?!', 'HOU JE VAST! SHE IS\nBUILT LIKE A BOILER.'],
    flash: ['FLITSER! THAT IS A\nDAY OF WORK GONE.'],
    hostage: ['GOT A LEAK UP THERE?\nNO, A HOSTAGE!', 'HOSTAGE ON THE ROOF.\nHOLD THE RAILS!'],
    low: ['SHE IS LEAKING OIL!\nDUCT TAPE, ANYONE?', 'PRESSURE DROPPING!\nSHE NEEDS A FIX!'],
    tunnel: ['NICE PIPES IN HERE.', 'TUNNEL! LISTEN TO\nTHAT ECHO.'],
    boss: ['THAT THING NEEDS\nA BIG WRENCH.'],
    exit: ['AFSLAG! JOB DONE.', 'AFSLAG! I SEND THE\nBILL ON MONDAY.'],
    arrive: ["FIXED. LET'S GO!", 'NEW PARTS. SAME DIRK.'],
    scan: ['SCAN CAR! KEEP\nMOVING, MATE.', 'RED LANE! GET OUT\nBEFORE IT SCANS US!'],
    tow: ['THAT HOOK IS ON\nMY BUMPER! SWERVE!', 'SHOOT THE CABLE!\nI CAN SPLICE IT LATER.'],
    brake: ['BRAKE CHECK! WATCH\nTHE RADIATOR!', 'BRAKE LIGHTS! HE\nSTOPS ON A DIME!'],
    caravan: ['LOOSE HITCH!\nBAD WELDING.', 'THAT TOW BAR WAS\nNEVER TORQUED RIGHT.'],
    roadworks: ['ROAD WORKS. THEY\nNEVER FINISH.', 'COLLEAGUES! NO,\nTHEY THROW CONES.'],
    boarder: ['BOOTS OFF MY BONNET!', 'GET OFF! THAT BONNET\nIS FRESHLY POLISHED!'],
    sticker: ['STICKER ON THE GLASS!\nSCRAPE IT OFF!', 'A FINE ON MY GLASS?\nSWERVE IT LOOSE!'],
  },
  bob: {
    board: ['STAP IN! WE CARPOOL\nFOR THE PLANET!', 'STAP IN! I JUST FLEW\nBACK FROM ISTANBUL.'],
    bump: ['SORRY! SORRY!\nHOU JE VAST!', 'OOPS! I OFFSET THAT\nBUMP WITH A TREE.'],
    flash: ['FLITSER! I WAS DOING\nTHE ECO SPEED!'],
    hostage: ['A HOSTAGE ON THE ROOF!\nGREEN TRANSPORT!', 'ROOF RIDER! THAT IS\nONE CAR LESS!'],
    low: ['DE VOLVO ROOKT!\nCARBON NEUTRAL...?', 'SHE SMOKES! I WILL\nOFFSET IT, PROMISE!'],
    tunnel: ['TUNNEL! HOLD YOUR\nBREATH!', 'TUNNEL! NO SOLAR\nPANELS IN HERE.'],
    boss: ['A DIESEL MONSTER!\nTAKE IT DOWN!'],
    exit: ['AFSLAG! I PLANT A TREE.', 'AFSLAG! NEXT STOP:\nTHE AIRPORT.'],
    arrive: ['RECYCLED A VOLVO!', 'ANOTHER VOLVO?\nI WILL OFFSET IT!'],
    scan: ['A SCAN CAR! WE PAID\nFOR PARKING, RIGHT?', 'RED LANE! CHANGE\nLANE, PLEASE!'],
    tow: ['NOT THE TOW TRUCK!\nSHE STILL RUNS!', 'HOOKED! SWERVE, OR\nSHOOT THE CABLE!'],
    brake: ['HE BRAKES!\nSORRY! SORRY!', 'BRAKE LIGHTS! ENERGY\nRECOVERY, I HOPE.'],
    caravan: ['A CARAVAN ON THE A10?\nIN THIS ECONOMY?', 'GLAMPING GONE WRONG!\nDODGE IT!'],
    roadworks: ['NEW CYCLE LANE,\nI HOPE!', 'ROAD WORKS! MORE\nASPHALT, SIGH.'],
    boarder: ['PLEASE GET OFF\nTHE BONNET!', 'NO HITCHHIKING ON\nTHE BONNET, PLEASE!'],
    sticker: ['A FINE! IS IT\nAT LEAST RECYCLED?', 'PAPER FINES? THINK\nOF THE TREES!'],
  },
  patrick: {
    board: ['STAP IN!\nTHE AI SAYS: DRIVE.', 'STAP IN! FRIKANDEL\nBREAK IS OVER.'],
    bump: ['BUMP DETECTED.\nHOU JE VAST!', 'COLLISION LOGGED.\nRETRAINING MODEL.'],
    flash: ['FLITSER! I SHOULD\nHAVE CHECKED THE APP.'],
    hostage: ['NEW PASSENGER LOADED\nON THE ROOF RACK.', 'HOSTAGE ON THE ROOF.\nUPLOAD COMPLETE.'],
    low: ['ARMOUR LOW!\nTHE AI SAYS: PANIC.', 'BATTERY... I MEAN\nARMOUR LOW!'],
    tunnel: ['NO SIGNAL IN HERE!', 'TUNNEL! SWITCHING\nTO OFFLINE MODE.'],
    boss: ['BOSS FIGHT!\nI KNEW IT. SAVE FIRST.'],
    exit: ['AFSLAG! ROUTE DONE.', 'AFSLAG! FRIKANDEL\nSPECIAAL, HERE I COME.'],
    arrive: ['REBOOTED. GO GO GO!', 'VOLVO 2.0 ONLINE.'],
    scan: ['SCAN DETECTED.\nCHANGE LANE.', 'THEY SCAN US? I SCAN\nTHEM BACK. CHANGE LANE!'],
    tow: ['TOW HOOK ATTACHED.\nSWERVE TO DETACH.', 'CABLE FOUND!\nSHOOT IT TO UNPLUG.'],
    brake: ['BRAKE CHECK INCOMING!', 'BRAKE LIGHTS! ADAPTIVE\nCRUISE, DO YOUR THING!'],
    caravan: ['CARAVAN UNHITCHED.\nRECALCULATING.', 'LOOSE CARAVAN! THE AI\nDID NOT PREDICT THIS.'],
    roadworks: ['ROAD WORKS AHEAD.\nTHE APP LIED.', 'CONES! REROUTING...\nREROUTING...'],
    boarder: ['INTRUDER ON THE\nBONNET!', 'BONNET INTRUDER!\nCLOSE RANGE: KNIFE!'],
    sticker: ['STICKER ON THE GLASS.\nSWERVE TO CLEAR.', 'SCREEN BLOCKED!\nSWERVE TO REFRESH.'],
  },
  default: {
    board: ['STAP IN!\nHOU JE VAST!'],
    bump: ['HOU JE VAST!', 'KIJK UIT!'],
    flash: ['NIET WEER EEN FLITSER!'],
    hostage: ['HOSTAGE ON THE ROOF!'],
    low: ['DE VOLVO HOUDT HET\nNIET LANG MEER!'],
    tunnel: ['TUNNEL! LIGHTS ON.'],
    boss: ['BIG TROUBLE AHEAD!'],
    exit: ['AFSLAG! WE ZIJN ER.'],
    arrive: ['WE ARE BACK!'],
    scan: ['SCAN CAR!\nCHANGE LANE!'],
    tow: ['TOW HOOK! SWERVE,\nOR SHOOT THE CABLE!'],
    brake: ['HE BRAKES!\nHOU JE VAST!'],
    caravan: ['WIE PARKEERT ER\nEEN CARAVAN?!'],
    roadworks: ['WEGWERKZAAMHEDEN!'],
    boarder: ['GET OFF THE BONNET!'],
    sticker: ['A FINE ON THE GLASS!\nSWERVE IT OFF!'],
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
