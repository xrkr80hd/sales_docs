"use client";

import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Organization = { id: string; name: string; slug: string };
type Membership = {
	organization_id: string;
	user_id: string;
	chat_enabled: boolean;
	can_dm: boolean;
	can_org_chat: boolean;
	updated_at?: string;
};
type MessengerUser = { id: string; display_name: string | null; role: string; email: string };
type AdminData = { organizations: Organization[]; memberships: Membership[]; users: MessengerUser[] };

async function api<T>(init?: RequestInit): Promise<T> {
	let accessToken = "";
	if (process.env.NEXT_PUBLIC_DISABLE_AUTH !== "1") {
		const { data } = await getSupabaseBrowserClient().auth.getSession();
		accessToken = data.session?.access_token ?? "";
	}
	const response = await fetch("/api/admin/messenger", {
		...init,
		headers: {
			authorization: `Bearer ${accessToken}`,
			"content-type": "application/json",
		},
	});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || "Messenger administration failed.");
	return result;
}

export default function MessengerAdmin() {
	const [data, setData] = useState<AdminData | null>(null);
	const [error, setError] = useState("");
	const [savingUserId, setSavingUserId] = useState("");

	async function load() {
		try {
			setError("");
			setData(await api<AdminData>());
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Could not load permissions.");
		}
	}

	useEffect(() => {
		void load();
	}, []);

	async function updatePermission(
		user: MessengerUser,
		membership: Membership | undefined,
		permission: "chat_enabled" | "can_dm" | "can_org_chat",
	) {
		if (!data) return;
		const organizationId = membership?.organization_id || data.organizations[0]?.id;
		if (!organizationId) {
			setError("Messenger requires an organization before member access can be managed.");
			return;
		}

		const nextMembership: Membership = {
			organization_id: organizationId,
			user_id: user.id,
			chat_enabled: membership?.chat_enabled ?? false,
			can_dm: membership?.can_dm ?? false,
			can_org_chat: membership?.can_org_chat ?? false,
			...membership,
			[permission]: !(membership?.[permission] ?? false),
		};

		setSavingUserId(user.id);
		setError("");
		setData((current) => current ? {
			...current,
			memberships: [
				...current.memberships.filter((item) => item.user_id !== user.id),
				nextMembership,
			],
		} : current);
		try {
			await api({
				method: "POST",
				body: JSON.stringify({
					userId: user.id,
					organizationId,
					chatEnabled: nextMembership.chat_enabled,
					canDm: nextMembership.can_dm,
					canOrgChat: nextMembership.can_org_chat,
				}),
			});
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Could not save permissions.");
			await load();
		} finally {
			setSavingUserId("");
		}
	}

	async function setOrganizationAccess(organizationId: string, enabled: boolean) {
		if (!data) return;
		const members = data.users.filter((user) => {
			const membership = data.memberships.find((item) => item.user_id === user.id);
			return !membership || membership.organization_id === organizationId;
		});
		const ownerIds = new Set(members.filter((user) => user.email.toLowerCase() === "xrkr80hd@gmail.com").map((user) => user.id));

		setSavingUserId(`organization:${organizationId}`);
		setError("");
		setData((current) => current ? {
			...current,
			memberships: [
				...current.memberships.filter((item) => !members.some((user) => user.id === item.user_id)),
				...members.map((user) => ({
					organization_id: organizationId,
					user_id: user.id,
					chat_enabled: enabled || ownerIds.has(user.id),
					can_dm: enabled || ownerIds.has(user.id),
					can_org_chat: enabled || ownerIds.has(user.id),
				})),
			],
		} : current);

		try {
			await Promise.all(members.map((user) => api({
				method: "POST",
				body: JSON.stringify({
					userId: user.id,
					organizationId,
					chatEnabled: enabled,
					canDm: enabled,
					canOrgChat: enabled,
				}),
			})));
			if (process.env.NEXT_PUBLIC_DISABLE_AUTH !== "1") await load();
		} catch (saveError) {
			setError(saveError instanceof Error ? saveError.message : "Could not update organization access.");
			await load();
		} finally {
			setSavingUserId("");
		}
	}

	return (
		<section className="grid gap-5">
			<header className="border border-[#2e3035] bg-[#17191d] px-5 py-5 text-white sm:px-6">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">Admin / Messenger</p>
						<h1 className="mt-1 text-2xl font-black">Member Messaging</h1>
						<p className="mt-1 text-sm text-neutral-400">Control what each team member can use.</p>
					</div>
					{data && (
						<p className="border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-300">
							{data.memberships.filter((item) => item.chat_enabled).length} of {data.users.length} enabled
						</p>
					)}
				</div>
			</header>

			{error && <p className="border border-red-800/40 bg-red-950/40 p-3 text-sm font-bold text-red-200">{error}</p>}

			{!data && !error && <p className="p-6 text-sm text-neutral-400">Loading member access...</p>}
			{data?.organizations.length === 0 && (
				<p className="border border-amber-600/40 bg-amber-950/30 p-4 text-sm font-bold text-amber-100">
					No organizations exist. Apply Supabase migrations 013-015 before assigning Messenger access.
				</p>
			)}

			{data?.organizations.map((organization, organizationIndex) => {
				const members = data.users.filter((user) => {
					const membership = data.memberships.find((item) => item.user_id === user.id);
					return membership?.organization_id === organization.id || (!membership && organizationIndex === 0);
				});
				const allEnabled = members.length > 0 && members.every((user) => {
					const membership = data.memberships.find((item) => item.user_id === user.id);
					return membership?.chat_enabled && membership.can_dm && membership.can_org_chat;
				});
				const organizationSaving = savingUserId === `organization:${organization.id}`;

				return (
					<section key={organization.id} className="overflow-hidden border border-[#2e3035] bg-[#121418]">
						<header className="flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-[#2e3035] bg-[#0f1114] px-4 py-3 sm:px-5">
							<div>
								<h2 className="text-sm font-black text-white">{organization.name}</h2>
								<p className="text-xs text-neutral-500">{members.length} members</p>
							</div>
							<label className="flex items-center gap-3 text-xs font-bold text-neutral-300">
								<span>{organizationSaving ? "Updating..." : "All member permissions"}</span>
								<button
									type="button"
									role="switch"
									aria-checked={allEnabled}
									disabled={organizationSaving || members.length === 0}
									onClick={() => void setOrganizationAccess(organization.id, !allEnabled)}
									className={`relative h-6 w-11 shrink-0 border transition ${allEnabled ? "border-emerald-500/60 bg-emerald-600" : "border-neutral-600 bg-[#25282e]"} disabled:opacity-50`}
								>
									<span className={`absolute top-0.5 h-4 w-4 bg-white transition-transform ${allEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
								</button>
							</label>
						</header>
						<div className="hidden grid-cols-[minmax(0,1fr)_minmax(27rem,auto)] items-center border-b border-[#2e3035] bg-[#14161a] px-5 py-2.5 sm:grid">
							<p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Team member</p>
							<p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Individual permissions</p>
						</div>
						{members.map((user) => {
							const membership = data.memberships.find((item) => item.user_id === user.id);
					const isOwner = user.email.toLowerCase() === "xrkr80hd@gmail.com";
					const displayName = user.display_name || user.email;
					const permissions = [
						{ key: "chat_enabled" as const, label: "Messenger", enabled: isOwner || Boolean(membership?.chat_enabled) },
						{ key: "can_dm" as const, label: "Direct Messages", enabled: isOwner || Boolean(membership?.can_dm) },
						{ key: "can_org_chat" as const, label: "Team Chat", enabled: isOwner || Boolean(membership?.can_org_chat) },
					];
					return (
						<div key={user.id} className="grid gap-4 border-b border-[#2e3035] bg-[#17191d] px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(12rem,1fr)_minmax(27rem,auto)] sm:items-center sm:px-5">
							<div className="flex min-w-0 items-center gap-3">
								<span className="grid h-9 w-9 shrink-0 place-items-center bg-[#292c32] text-xs font-black uppercase text-neutral-200">{displayName.charAt(0)}</span>
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<p className="truncate text-sm font-extrabold text-white">{displayName}</p>
										{isOwner && <span className="border border-red-500/30 bg-red-950/40 px-1.5 py-0.5 font-mono text-[8px] font-black uppercase text-red-300">Owner</span>}
									</div>
									<p className="truncate text-xs text-neutral-500">{user.email}</p>
								</div>
							</div>
							<div className="grid gap-2 sm:grid-cols-3" aria-label={`Messaging permissions for ${displayName}`}>
								{permissions.map((permission) => (
									<label key={permission.key} className="flex min-h-10 items-center justify-between gap-3 border border-[#2c3037] bg-[#111317] px-3 text-[10px] font-black uppercase tracking-[0.05em] text-neutral-300">
										<span>{permission.label}</span>
										<button
											type="button"
											role="switch"
											aria-label={`${permission.label} for ${displayName}`}
											aria-checked={permission.enabled}
											disabled={isOwner || savingUserId === user.id || data.organizations.length === 0}
											onClick={() => void updatePermission(user, membership, permission.key)}
											className={`relative h-5 w-9 shrink-0 border transition ${permission.enabled ? "border-emerald-500/60 bg-emerald-600" : "border-neutral-600 bg-[#25282e]"} disabled:cursor-not-allowed disabled:opacity-60`}
										>
											<span className={`absolute top-0.5 h-3.5 w-3.5 bg-white transition-transform ${permission.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
										</button>
									</label>
								))}
							</div>
						</div>
					);
						})}
					</section>
				);
			})}
		</section>
	);
}
