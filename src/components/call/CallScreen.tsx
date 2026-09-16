"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  type CallActionItem,
  type CallMessage,
  type CallNote,
  type CallParticipant,
  type CallRoom,
  type CallState,
  type NoteScope,
  type CallJoin,
  callSelf,
  callCounterpart,
  projectJoin,
} from "@/lib/call";
import { RelationshipPanel, type PanelActions } from "./RelationshipPanel";
import { RoomDialog, type RoomActions } from "./RoomDialog";
import { Dock, type SelfControls } from "./Dock";
import { useCallEvents } from "./useCallEvents";
import { Stage, type Layout } from "./Stage";
import { CallMedia } from "./CallMedia";
import { Duration } from "./Duration";
import { Icon } from "./Icon";

/**
 * A join, plus the guest call-session credential this app's API route still issues.
 * The credential is not part of the call contract and is on its way out — guests are
 * media-only — so it is carried here rather than in the projected envelope.
 */
type Access = CallJoin & { callSessionToken: string | null };

const readAccess = (body: unknown): Access => ({
  ...projectJoin(body),
  callSessionToken:
    typeof (body as { callSessionToken?: unknown })?.callSessionToken === "string"
      ? (body as { callSessionToken: string }).callSessionToken
      : null,
});

export type GuestCallJoin = {
  invitationToken: string;
  displayName: string;
  acceptedTerms: boolean;
  anonymousInstallId: string;
};

export function CallScreen({
  groupCallId,
  me,
  displayName,
  guestJoin,
  onLeave,
}: {
  groupCallId: string;
  me: string;
  displayName?: string;
  guestJoin?: GuestCallJoin;
  onLeave?: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<CallState>();
  const [error, setError] = useState("");
  const [access, setAccess] = useState<Access>();
  const [joinError, setJoinError] = useState("");
  const [roomOpen, setRoomOpen] = useState(false);
  const [layout, setLayout] = useState<Layout>("speaker");
  // Pinning is a per-viewer choice here; the contract stores it on the participant row,
  // which would pin the tile for everyone in the call rather than for the person who asked.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Which seats LiveKit has connected. A roster row is created when someone is invited
  // or admitted, so only the room can say who is actually here.
  const [online, setOnline] = useState<string[]>([]);

  const callHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    const token = access?.callSessionToken;
    if (token) headers["X-Caffriend-Call-Session"] = token;
    return headers;
  }, [access?.callSessionToken]);

  const callApi = useCallback(
    <T,>(path: string, options: RequestInit = {}) =>
      api<T>(
        path,
        { ...options, headers: { ...callHeaders, ...options.headers } },
        "call",
      ),
    [callHeaders],
  );

  useEffect(() => {
    let live = true;
    setState(undefined);
    setError("");
    setJoinError("");
    const fail = (failure: unknown) => {
      if (!live) return;
      const message =
        failure instanceof Error
          ? failure.message
          : "This call could not be loaded right now.";
      setError(message);
      setJoinError(message);
    };
    const join = (body: Record<string, unknown>) =>
      api(
        `${groupCallId}/join`,
        { method: "POST", body: JSON.stringify(body) },
        "call",
      ).then(readAccess);
    const resolve = () => api(`${groupCallId}/resolve`, {}, "call");

    if (guestJoin) {
      const joinBody = {
        displayName: guestJoin.displayName,
        anonymousInstallId: guestJoin.anonymousInstallId,
        invitationToken: guestJoin.invitationToken,
        acceptedTerms: guestJoin.acceptedTerms,
      };
      resolve()
        .then(() => join(joinBody))
        .then((joined) => {
          if (!live) return;
          setAccess(joined);
          // Pass the call-session token directly — setAccess is async state and won't
          // be readable from callHeaders until after the next render, so we carry the
          // token through the chain explicitly instead of relying on the memoised value.
          return api<CallState>(
            `${groupCallId}/call-state`,
            {
              headers: joined.callSessionToken
                ? { "X-Caffriend-Call-Session": joined.callSessionToken }
                : {},
            },
            "call",
          );
        })
        .then((value) => {
          if (live && value) {
            // A fresh join resets screen share: the LiveKit track has not been
            // published yet in this session, so treat it as off even if the previous
            // participant row still carries `screenShareOn: true` from before they left.
            setState({
              ...value,
              participants: value.participants.map((p) =>
                p.userId === me ? { ...p, screenShareOn: false } : p,
              ),
            });
          }
        })
        .catch(fail);
    } else {
      resolve()
        // `displayName` is required, 1-200 chars: a join without one is refused with
        // 400 and surfaced as "This call could not be loaded right now.", which is
        // what every Join press from Meetings and Upcoming Calls used to land on.
        .then(() => join({ displayName: displayName ?? "Caffriend member" }))
        .then((joined) => {
          if (!live) return;
          setAccess(joined);
          // Same as the guest path: carry the token explicitly rather than waiting for
          // callHeaders to re-derive after the state update settles.
          return api<CallState>(
            `${groupCallId}/call-state`,
            {
              headers: joined.callSessionToken
                ? { "X-Caffriend-Call-Session": joined.callSessionToken }
                : {},
            },
            "call",
          );
        })
        .then((value) => {
          if (live && value) {
            setState({
              ...value,
              participants: value.participants.map((p) =>
                p.userId === me ? { ...p, screenShareOn: false } : p,
              ),
            });
          }
        })
        .catch(fail);
    }
    return () => {
      live = false;
    };
  }, [groupCallId, guestJoin, displayName, me]);

  const applyEvent = useCallback(
    (patch: (value: CallState) => CallState) =>
      setState((current) => current && patch(current)),
    [],
  );
  /**
   * The account behind this seat, which the join now names. A guest arrives knowing
   * only their install id, so without this a private note broadcast back to its own
   * author would not be recognised as theirs.
   */
  const viewer = access?.userId ?? me;
  // Nothing subscribes before the join returns: the socket refuses a subscription
  // without a seat, and there is no participantId to subscribe with until then.
  useCallEvents(
    groupCallId,
    viewer,
    applyEvent,
    access?.callSessionToken ?? null,
    access?.participantId ?? null,
  );

  const post = useCallback(
    <T,>(path: string, body: Record<string, unknown>) =>
      callApi<T>(`${groupCallId}/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    [callApi, groupCallId],
  );

  const patchParticipant = useCallback(
    (person: CallParticipant) =>
      setState(
        (current) =>
          current && {
            ...current,
            participants: current.participants.map((row) =>
              row.id === person.id ? person : row,
            ),
          },
      ),
    [],
  );

  /**
   * Moderation is applied from the confirmed row rather than by reloading the call:
   * a reload would also discard everyone's live mic, camera and hand state for the
   * sake of one person's seat.
   */
  const decide = useCallback(
    async (person: CallParticipant, decision: "admit" | "decline") => {
      const seated = await post<CallParticipant>(
        `waiting-room/${person.id}/${decision}`,
        {},
      );
      setState(
        (current) =>
          current && {
            ...current,
            waitingRoom: current.waitingRoom.filter(
              (row) => row.id !== person.id,
            ),
            participants:
              decision === "admit"
                ? [...current.participants, seated]
                : current.participants,
          },
      );
    },
    [post],
  );

  const remove = useCallback(
    async (person: CallParticipant) => {
      await post<CallParticipant>(`participants/${person.id}/remove`, {});
      setState(
        (current) =>
          current && {
            ...current,
            participants: current.participants.filter(
              (row) => row.id !== person.id,
            ),
          },
      );
    },
    [post],
  );

  const control = useCallback(
    async (field: "locked" | "muteOnEntry", next: boolean) => {
      setState(
        (current) =>
          current && { ...current, room: { ...current.room, [field]: next } },
      );
      try {
        const room = await post<CallRoom>("call-controls", { [field]: next });
        setState(
          (current) =>
            current && {
              ...current,
              room: {
                ...current.room,
                locked: room.locked,
                muteOnEntry: room.muteOnEntry,
              },
            },
        );
      } catch (failure) {
        setState(
          (current) =>
            current && {
              ...current,
              room: { ...current.room, [field]: !next },
            },
        );
        throw failure;
      }
    },
    [post],
  );

  /**
   * Which seat is mine, by the id my own join came back with. Guessing from userId
   * cannot answer this for a guest, who has no account, and it is what left the dock
   * unrendered for anyone who arrived from the emailed link.
   */
  const mine = useMemo(
    () => callSelf(state?.participants ?? [], access?.participantId) ?? undefined,
    [access?.participantId, state],
  );

  useEffect(() => {
    if (
      !access?.participantId ||
      state?.room.status !== "OPEN" ||
      state.room.endedAt
    )
      return;
    const heartbeat = () => {
      void post("heartbeat", { participantId: access.participantId }).catch(
        () => undefined,
      );
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 5_000);
    const leaveOnClose = () => {
      const headers = {
        "Content-Type": "application/json",
        "X-Caffriend-Request": "1",
        ...callHeaders,
      };
      fetch(`/api/call/${groupCallId}/leave`, {
        method: "POST",
        headers,
        body: JSON.stringify({ participantId: access.participantId }),
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("beforeunload", leaveOnClose);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", leaveOnClose);
    };
  }, [
    access?.participantId,
    callHeaders,
    groupCallId,
    post,
    state?.room.endedAt,
    state?.room.status,
  ]);

  /**
   * Your own controls apply at once and roll back if the server refuses. Waiting for
   * the round trip reads as a dead control — the surface people notice first.
   */
  const toggleSelf = useCallback(
    async (
      field: "micOn" | "cameraOn" | "handRaised" | "screenShareOn",
      next: boolean,
    ) => {
      if (!mine) return;
      patchParticipant({ ...mine, [field]: next });
      try {
        patchParticipant(
          await post<CallParticipant>(`participants/${mine.id}/state`, {
            [field]: next,
          }),
        );
      } catch (failure) {
        patchParticipant(mine);
        throw failure;
      }
    },
    [mine, patchParticipant, post],
  );

  const send = useCallback(
    async (text: string, reply: CallMessage | null, mentions: string[]) => {
      // Do not append locally — the server broadcasts a `call.chat.message.created`
      // event back to all participants including the sender, and `applyCallEvent`
      // deduplicates by id. A local append that races the broadcast causes the double-
      // message the user sees when the socket fires before setState settles.
      await post<CallMessage>("call-chat/messages", {
        message: text,
        replyToMessageId: reply?.id ?? null,
        mentions,
      });
    },
    [post],
  );

  const addNote = useCallback(
    async (scope: NoteScope, body: string) => {
      // Do not append locally. As with send() and addAction(), the server broadcasts
      // `call.note.created` back to the author too, and the POST answers with the bare
      // note while the broadcast wraps it — so a local append could never be recognised
      // as the same note, and every note the author wrote showed up twice for them.
      await post<CallNote>("notes", { scope, body });
    },
    [post],
  );

  const addAction = useCallback(
    async (text: string) => {
      // Same as send(): the server broadcasts `call.action_item.created` to all
      // participants; relying on the socket event avoids the duplicate that appears
      // when the local append and the broadcast both land.
      await post<CallActionItem>("action-items", { text });
    },
    [post],
  );

  const toggleAction = useCallback(
    async (item: CallActionItem, done: boolean) => {
      const patch = (value: CallActionItem) =>
        setState(
          (current) =>
            current && {
              ...current,
              actionItems: current.actionItems.map((row) =>
                row.id === value.id ? value : row,
              ),
            },
        );
      patch({ ...item, done });
      try {
        patch(await post<CallActionItem>(`action-items/${item.id}`, { done }));
      } catch (failure) {
        patch(item);
        throw failure;
      }
    },
    [post],
  );

  if (error)
    return (
      <main>
        <p role="alert">{error}</p>
      </main>
    );
  if (!state)
    return (
      <main aria-busy="true">
        <p role="status">Loading the call…</p>
      </main>
    );

  const moderator = state.room.hostId === me || mine?.role === "co_host";
  const group =
    state.participants.length > 2 || state.room.kind !== "COFFEE_CHAT";
  // A one-to-one is named by who you are talking to, not by what kind of call it is —
  // "Coffee chat" was the same words on every call anybody ever opened. A group has no
  // single counterpart, so it keeps the room's own title.
  const counterpart = callCounterpart(state.participants, me);
  const counterpartDetail = counterpart
    ? [counterpart.jobTitle, counterpart.company].filter(Boolean).join(" · ")
    : "";
  // A call that has ended keeps its panel: the notes, commitments and agenda are the
  // point of the call, and they outlive it. Nothing live is offered any more.
  const ended = state.room.status !== "OPEN" || Boolean(state.room.endedAt);
  const panelActions: PanelActions = {
    onSend: send,
    onAddNote: addNote,
    onToggleAction: toggleAction,
    onAddAction: addAction,
    // The room's own address is the invite: whoever opens it joins, or waits to be let in.
    inviteUrl:
      typeof window === "undefined"
        ? ""
        : `${window.location.origin}/calls/${groupCallId}`,
  };
  const roomActions: RoomActions = {
    onDecide: decide,
    onRemove: remove,
    onControl: control,
  };
  const leave = async () => {
    if (access?.participantId) {
      await post("leave", { participantId: access.participantId }).catch(
        () => undefined,
      );
    }
    onLeave?.();
    if (!onLeave) router.push("/calls");
  };
  const selfControls: SelfControls = { onToggle: toggleSelf, onLeave: leave };

  return (
    <main className="call">
      <header className="call-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="call-wordmark"
          src="/brand/logo-wordmark-orange.png"
          alt="Caffriend"
        />
        <span className="call-header-rule" aria-hidden="true" />
        <div className="call-header-title">
          <h1>{counterpart?.displayName ?? state.room.title ?? "Coffee chat"}</h1>
          {counterpart && counterpartDetail && (
            <p className="call-header-detail">{counterpartDetail}</p>
          )}
        </div>
        {ended ? (
          <p className="call-ended">This call has ended</p>
        ) : (
          <Duration
            startedAt={state.room.startedAt}
            endedAt={state.room.endedAt}
          />
        )}
        {!ended && (
          <span className="call-mode-pill">
            <Icon name={group ? "people-fill" : "person-fill"} size={15} />
            {group ? "Group" : "1-on-1"}
          </span>
        )}
        {!ended && (
          <div
            className="call-layout-switch"
            role="group"
            aria-label="Stage layout"
          >
            <button
              aria-pressed={layout === "speaker"}
              onClick={() => setLayout("speaker")}
              title="Speaker view"
            >
              <Icon name="person-video2" size={15} />
              <span className="call-sr">Speaker view</span>
            </button>
            <button
              aria-pressed={layout === "grid"}
              onClick={() => setLayout("grid")}
              title="Grid view"
            >
              <Icon name="grid-3x3-gap-fill" size={15} />
              <span className="call-sr">Grid view</span>
            </button>
          </div>
        )}
        {!ended && moderator && (
          <button
            className="call-room-button"
            onClick={() => setRoomOpen(true)}
          >
            <Icon
              name={state.room.locked ? "lock-fill" : "door-open"}
              size={15}
            />
            Room
            {state.waitingRoom.length > 0 && (
              <span className="call-room-count">
                {state.waitingRoom.length}
              </span>
            )}
          </button>
        )}
      </header>

      <div className="call-body">
        {!ended && (
          <div className="call-stage">
            {joinError && <p role="alert">{joinError}</p>}
            <CallMedia
              credentials={access}
              micOn={mine?.micOn ?? false}
              cameraOn={mine?.cameraOn ?? false}
              shareOn={mine?.screenShareOn ?? false}
              onPresence={setOnline}
              onShareEnded={() => {
                // The share can end outside the dock — a dismissed picker, or Chrome's
                // own "Stop sharing" bar. The row follows the track, not the button.
                if (mine?.screenShareOn) void toggleSelf("screenShareOn", false);
              }}
            >
              {(video) => (
                <Stage
                  participants={state.participants}
                  me={mine?.userId ?? me}
                  layout={layout}
                  pinnedId={pinnedId}
                  onPin={setPinnedId}
                  videoFor={video}
                  inviteUrl={panelActions.inviteUrl}
                />
              )}
            </CallMedia>
            <Dock me={mine} controls={selfControls} />
          </div>
        )}
        <RelationshipPanel
          state={state}
          me={me}
          online={online}
          actions={panelActions}
          readOnly={ended}
        />
      </div>

      {roomOpen && (
        <RoomDialog
          room={state.room}
          me={me}
          waitingRoom={state.waitingRoom}
          participants={state.participants}
          actions={roomActions}
          onClose={() => setRoomOpen(false)}
        />
      )}
    </main>
  );
}
