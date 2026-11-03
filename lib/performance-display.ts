import { type MonthBoard, type BoardRow, pace } from "@/lib/manager-board";

export type DisplayRow = Pick<BoardRow, "objective" | "mtd" | "weeklyGoal" | "avg90" | "projection" | "newSold" | "usedSold" | "newGrossActual" | "usedGrossActual">;
export type DisplayBoard = Pick<MonthBoard, "newGoal" | "usedGoal" | "newGrossGoal" | "usedGrossGoal" | "monthlyGross"> & {rows:Record<string, DisplayRow>};

const numeric=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;

export function attainment(sold:number, goal:number) {
  return goal > 0 && Number.isFinite(sold) && Number.isFinite(goal) ? `${Math.round(sold / goal * 100)}%` : "N/A";
}

/** Match management's assigned-roster totals; MTD remains its separate saved metric. */
export function performanceSummary(board:DisplayBoard, roster:{id:string}[]) {
  const totals=roster.reduce((sum, person)=>{
    const row=board.rows[person.id];
    return {newSold:sum.newSold+numeric(row?.newSold),usedSold:sum.usedSold+numeric(row?.usedSold),newGross:sum.newGross+numeric(row?.newGrossActual),usedGross:sum.usedGross+numeric(row?.usedGrossActual)};
  },{newSold:0,usedSold:0,newGross:0,usedGross:0});
  const newGross=numeric(board.newGrossGoal??board.monthlyGross??0), usedGross=numeric(board.usedGrossGoal??0);
  return [
    {label:"New",goal:numeric(board.newGoal),sold:totals.newSold,grossGoal:newGross,grossActual:totals.newGross},
    {label:"Used",goal:numeric(board.usedGoal),sold:totals.usedSold,grossGoal:usedGross,grossActual:totals.usedGross},
    {label:"Combined",goal:numeric(board.newGoal)+numeric(board.usedGoal),sold:totals.newSold+totals.usedSold,grossGoal:newGross+usedGross,grossActual:totals.newGross+totals.usedGross},
  ];
}

// This is the existing MTD / monthly objective calculation, not a new forecast.
export function displayPace(row:DisplayRow) { return pace(row as BoardRow); }
