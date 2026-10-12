// Cose in comune agli script delle pagine: dati del sito, memoria delle scelte, date scritte per esteso, disponibilità.
import { chiave, daChiave, piu, piuMesi, oggiRoma, occupateEsempio, libera, notti } from './prezzi.js?v=2';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

/** Prezzi, regole e tratte: scritti nella pagina quando il sito viene costruito (componente DatiSito, da src/lib/data.js) */
export const dati = (() => {
	try {
		return JSON.parse(document.getElementById('dati-sito')?.textContent || '{}');
	} catch {
		return {};
	}
})();

/* ---------- Memoria delle scelte (solo nel browser di chi naviga, per questa visita) ---------- */
// Serve a ritrovare le date passando da una pagina all'altra. Niente dati personali. Dove la memoria del browser
// non è disponibile (navigazione privata, alcune anteprime) le scelte valgono solo nella pagina aperta.
const riserva = new Map();
export const memoria = {
	leggi(nome) {
		try {
			const v = sessionStorage.getItem(nome);
			if (v) return JSON.parse(v);
		} catch {
			// memoria non disponibile
		}
		return riserva.get(nome) ?? null;
	},
	scrivi(nome, valore) {
		riserva.set(nome, valore);
		try {
			sessionStorage.setItem(nome, JSON.stringify(valore));
		} catch {
			// memoria non disponibile
		}
	},
	togli(nome) {
		riserva.delete(nome);
		try {
			sessionStorage.removeItem(nome);
		} catch {
			// memoria non disponibile
		}
	}
};

/* ---------- Scelte passate nell'indirizzo: prenota.html#casa=il-nido&dal=2026-11-06 ---------- */
export const parametri = () => {
	let scelte = '';
	try {
		if (location.hash.includes('=')) scelte = location.hash.slice(1);
		// riserva: le stesse scelte lasciate un attimo prima dal link che ha portato qui (app.js), se l'indirizzo non le ha
		const p = JSON.parse(sessionStorage.getItem('lago-passaggio') || 'null');
		sessionStorage.removeItem('lago-passaggio');
		const qui = location.pathname.split('/').pop() || 'index.html';
		if (!scelte && p && p.pagina === qui && Date.now() - p.quando < 60000) scelte = p.scelte;
	} catch {
		// memoria non disponibile
	}
	try {
		return Object.fromEntries(new URLSearchParams(scelte));
	} catch {
		return {};
	}
};
export const conParametri = (pagina, scelte) => {
	const q = new URLSearchParams();
	for (const [k, v] of Object.entries(scelte)) if (v !== '' && v != null) q.set(k, String(v));
	const base = String(pagina).split('#')[0];
	const testo = q.toString();
	return testo ? `${base}#${testo}` : base;
};

/* ---------- Date scritte ---------- */
const anno = (d) => (d.getFullYear() !== oggiRoma().getFullYear() ? { year: 'numeric' } : {});
/** «venerdì 6 novembre» */
export const lungo = (k) => {
	const d = typeof k === 'string' ? daChiave(k) : k;
	return d ? d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', ...anno(d) }) : '';
};
/** «ven 6 nov» */
export const corto = (k) => {
	const d = typeof k === 'string' ? daChiave(k) : k;
	return d ? d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', ...anno(d) }) : '';
};
export const quanteNotti = (n) => `${n} ${n === 1 ? 'notte' : 'notti'}`;

/* ---------- Disponibilità (DI ESEMPIO, vedi prezzi.js) ---------- */
const reg = dati.regole || {};
/** Primo e ultimo giorno prenotabile */
export const limiti = (anticipo = reg.anticipoGiorni ?? 1, mesi = reg.mesiAvanti ?? 12) => {
	const o = oggiRoma();
	return { min: piu(o, anticipo), max: piuMesi(o, mesi) };
};
const cache = new Map();
/** Le notti occupate di una mansarda */
export function occupate(slug) {
	if (!cache.has(slug)) cache.set(slug, occupateEsempio(slug, chiave(piuMesi(oggiRoma(), (reg.mesiAvanti ?? 12) + 2))));
	return cache.get(slug);
}
/** La notte è occupata? Senza mansarda scelta: solo se sono occupate tutte */
export const notteOccupata = (slug, k) => (slug ? occupate(slug).has(k) : (dati.mansarde || []).every((m) => occupate(m.slug).has(k)));
/** Il soggiorno è possibile? Senza mansarda scelta: basta che ne sia libera una */
export const soggiornoLibero = (slug, dal, al) => (slug ? libera(occupate(slug), dal, al) : (dati.mansarde || []).some((m) => libera(occupate(m.slug), dal, al)));
/** Date ancora buone? (non passate, entro il limite, numero di notti ammesso) */
export function dateValide(dal, al) {
	const a = daChiave(dal);
	const b = daChiave(al);
	if (!a || !b) return false;
	const { min, max } = limiti();
	const n = notti(dal, al);
	return a >= min && a <= max && n >= (reg.nottiMin || 1) && n <= (reg.nottiMax || 28);
}
