import { useMemo } from "react";
import type { FactionMission, FactionOrder, RunState } from "../models/types";
import { FactionMissionService } from "../services/FactionMissionService";

type TaskBoardOverlayProps = {
  run: RunState;
  onAccept: (missionId: string) => void;
  onResolve: (missionId: string, success?: boolean) => void;
  onPostWork: () => void;
  onLeave: () => void;
};

function statusTone(status: FactionMission["status"] | FactionOrder["status"]): string {
  switch (status) {
    case "AVAILABLE":
    case "ISSUED":
      return "is-open";
    case "ACTIVE":
    case "ACCEPTED":
      return "is-active";
    case "COMPLETED":
      return "is-done";
    case "FAILED":
    case "REFUSED":
      return "is-failed";
    default:
      return "";
  }
}

export function TaskBoardOverlay({
  run,
  onAccept,
  onResolve,
  onPostWork,
  onLeave,
}: TaskBoardOverlayProps) {
  const missions = useMemo(() => FactionMissionService.listMissions(run), [run]);
  const orders = useMemo(() => FactionMissionService.listOrders(run), [run]);
  const open = missions.filter((m) => m.status === "AVAILABLE" || m.status === "ACTIVE");
  const archive = missions.filter((m) => m.status === "COMPLETED" || m.status === "FAILED").slice(-6);
  const activeOrders = orders.filter((o) => o.status === "ISSUED" || o.status === "ACCEPTED");

  return (
    <div className="overlay-scrim task-board-scrim">
      <section className="task-board-shell panel">
        <header className="task-board-head">
          <div>
            <p className="hud-kicker">Notices</p>
            <h2 className="font-display text-3xl text-gold">Task Board</h2>
            <p className="task-board-sub">
              Accept faction work, finish active jobs, or post for fresh notices.
            </p>
          </div>
          <button className="ghost-btn" onClick={onLeave} type="button">
            Leave
          </button>
        </header>

        <div className="task-board-actions">
          <button className="choice-btn" onClick={onPostWork} type="button">
            Scan for new work
            <span className="harbor-action-meta">Posts a fresh available mission</span>
          </button>
        </div>

        <div className="task-board-columns">
          <section>
            <p className="detail-label">Missions</p>
            {open.length === 0 ? (
              <p className="task-board-empty">No open missions. Scan the board for new work.</p>
            ) : (
              <ul className="task-board-list">
                {open.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onAccept={onAccept}
                    onResolve={onResolve}
                  />
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="detail-label">Faction orders</p>
            {activeOrders.length === 0 ? (
              <p className="task-board-empty">No standing orders from command.</p>
            ) : (
              <ul className="task-board-list">
                {activeOrders.map((order) => (
                  <li className={`task-board-card ${statusTone(order.status)}`} key={order.id}>
                    <strong>{order.title}</strong>
                    <p>{order.description}</p>
                    <span className="task-board-meta">
                      {order.factionId.replace(/_/g, " ")} · {order.status}
                      {order.moralConflict ? " · moral weight" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {archive.length > 0 ? (
              <>
                <p className="detail-label task-board-archive-label">Recent archive</p>
                <ul className="task-board-list is-archive">
                  {archive.map((mission) => (
                    <li className={`task-board-card ${statusTone(mission.status)}`} key={mission.id}>
                      <strong>{mission.title}</strong>
                      <span className="task-board-meta">
                        {mission.status} · day {mission.offeredDay}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}

function MissionCard({
  mission,
  onAccept,
  onResolve,
}: {
  mission: FactionMission;
  onAccept: (missionId: string) => void;
  onResolve: (missionId: string, success?: boolean) => void;
}) {
  const rewardBits = [
    mission.rewards?.berries != null ? `฿${mission.rewards.berries}` : null,
    mission.rewards?.xp != null ? `${mission.rewards.xp} XP` : null,
    mission.rewards?.factionStanding != null
      ? `+${mission.rewards.factionStanding} standing`
      : null,
  ].filter(Boolean);

  return (
    <li className={`task-board-card ${statusTone(mission.status)}`}>
      <strong>{mission.title}</strong>
      <p>{mission.description}</p>
      <span className="task-board-meta">
        {mission.factionId.replace(/_/g, " ")} · {mission.status}
        {mission.moralConflict ? " · moral conflict" : ""}
        {rewardBits.length ? ` · ${rewardBits.join(" · ")}` : ""}
      </span>
      <div className="task-board-card-actions">
        {mission.status === "AVAILABLE" ? (
          <button className="choice-btn" onClick={() => onAccept(mission.id)} type="button">
            Accept
          </button>
        ) : null}
        {mission.status === "ACTIVE" ? (
          <>
            <button className="choice-btn" onClick={() => onResolve(mission.id, true)} type="button">
              Turn in success
            </button>
            <button className="ghost-btn" onClick={() => onResolve(mission.id, false)} type="button">
              Report failure
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}
