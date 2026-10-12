// Motore dei conti e delle date del sito: notti, prezzo del soggiorno, tassa di soggiorno, corse con autista.
// Funzioni pure, senza prezzi dentro: i numeri arrivano da src/lib/data.js (domani dal server).
// Questo file viene copiato in static/js/prezzi.js (npm run motori): il sito e, in futuro, il server
// fanno gli stessi conti con lo stesso codice. Il server dovrà SEMPRE rifare il conto prima di far pagare.

/* ---------- Date: giorni civili, senza ore (niente salti col cambio dell'ora) ---------- */
const due = (n) => String(n).padStart(2, '0');
export const chiave = (d) => `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
export const daChiave = (k) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) return null;
	const [y, m, g] = k.split('-').map(Number);
	const d = new Date(y, m - 1, g);
	return d.getMonth() === m - 1 && d.getDate() === g ? d : null;
};
export const piu = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const piuMesi = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
export const piuChiave = (k, n) => chiave(piu(daChiave(k), n));
/** Quante notti tra due giorni (chiavi AAAA-MM-GG); 0 se le date non vanno bene */
export function notti(dal, al) {
	const a = daChiave(dal);
	const b = daChiave(al);
	if (!a || !b) return 0;
	const n = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
	return n > 0 ? n : 0;
}
/** «Oggi» è il giorno civile a Roma, qualunque sia il fuso del dispositivo */
export function oggiRoma(adesso = new Date()) {
	try {
		const parti = Object.fromEntries(
			new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: 'numeric', day: 'numeric' })
				.formatToParts(adesso)
				.map((x) => [x.type, x.value])
		);
		const d = new Date(Number(parti.year), Number(parti.month) - 1, Number(parti.day));
		if (!Number.isNaN(d.getTime())) return d;
	} catch {
		// fuso orario non disponibile: si usa quello del dispositivo
	}
	return new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate());
}

/* ---------- Soldi ---------- */
const cent = (n) => Math.round(n * 100) / 100;
/** 1250 → «1.250 €», 12.5 → «12,50 €» */
export function euro(n) {
	const v = cent(Number(n) || 0);
	const intero = Math.trunc(Math.abs(v));
	const decimali = Math.round((Math.abs(v) - intero) * 100);
	const testo = String(intero).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decimali ? ',' + due(decimali) : '');
	return `${v < 0 ? '−' : ''}${testo} €`;
}

/* ---------- Disponibilità ---------- */
/**
 * DISPONIBILITÀ DI ESEMPIO. Periodi occupati finti, sempre gli stessi per ogni mansarda: servono solo a far vedere
 * il calendario con qualche giorno pieno. Da sostituire con il calendario vero (prenotazioni del sito + Airbnb e Booking).
 * Ritorna l'elenco delle NOTTI occupate (chiave = il giorno in cui si va a dormire).
 */
export function occupateEsempio(slug, finoA) {
	let seme = 0;
	for (const c of String(slug)) seme = (seme * 31 + c.charCodeAt(0)) >>> 0;
	const caso = () => {
		// generatore semplice e ripetibile (mulberry32)
		seme = (seme + 0x6d2b79f5) >>> 0;
		let t = seme;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const fine = daChiave(finoA) ?? new Date(2028, 0, 1);
	const occupate = new Set();
	let g = new Date(2026, 0, 1);
	while (g < fine) {
		g = piu(g, 3 + Math.floor(caso() * 9)); // da 3 a 11 notti libere
		const quante = 2 + Math.floor(caso() * 5); // poi da 2 a 6 notti occupate
		for (let i = 0; i < quante; i++) occupate.add(chiave(piu(g, i)));
		g = piu(g, quante);
	}
	return occupate;
}

/** Tutte le notti tra arrivo e partenza sono libere? occupate: Set di chiavi (o elenco) */
export function libera(occupate, dal, al) {
	const n = notti(dal, al);
	if (!n) return false;
	const set = occupate instanceof Set ? occupate : new Set(occupate || []);
	for (let i = 0; i < n; i++) if (set.has(piuChiave(dal, i))) return false;
	return true;
}

/* ---------- Soggiorno ---------- */
/** Prezzo di una notte: alta stagione nei mesi indicati, altrimenti il prezzo base */
export function prezzoNotte(casa, k) {
	const mese = Number(String(k).slice(5, 7));
	const pr = casa.prezzo;
	return pr.mesiAlta?.includes(mese) && pr.alta ? pr.alta : pr.notte;
}
/**
 * La formula di pagamento si può scegliere per questo arrivo?
 * Quelle con il saldo «N giorni prima» (soloConAnticipo) valgono solo se all'arrivo mancano più di N giorni.
 */
export function formulaAmmessa(formula, dal, regole = {}, oggi = oggiRoma()) {
	if (!formula?.soloConAnticipo) return true;
	const a = daChiave(dal);
	return Boolean(a && a > piu(oggi, regole.cancellazioneGiorni || 7));
}
/** All'arrivo mancano più di N giorni? (finché è così la cancellazione gratuita è ancora possibile) */
export const conAnticipo = (dal, regole = {}, oggi = oggiRoma()) => formulaAmmessa({ soloConAnticipo: true }, dal, regole, oggi);

/** Il prezzo più basso a notte («Da 100 € a notte») */
export const daNotte = (casa) => Math.min(casa.prezzo.notte, casa.prezzo.alta || casa.prezzo.notte);

/**
 * Conto del soggiorno.
 * r: { dal, al, adulti }  casa: una mansarda di data.js  regole: { tassa, nottiMin, nottiMax }
 * formula: una delle formule di pagamento (o niente)  transfer: il conto di una corsa già calcolato (o niente)
 * Ritorna { ok, errore, notti, righe: [{ id, voce, dettaglio, importo }], totale, ora, dopo }
 */
export function contoSoggiorno(r, casa, regole = {}, formula = null, transfer = null) {
	const n = notti(r.dal, r.al);
	const adulti = Math.max(1, Math.min(casa.ospitiMax || 2, Number(r.adulti) || 1));
	if (!n) return { ok: false, errore: 'Scegli le date di arrivo e di partenza.', notti: 0, righe: [], totale: 0, ora: 0, dopo: 0 };
	if (regole.nottiMin && n < regole.nottiMin) return { ok: false, errore: `Il soggiorno minimo è di ${regole.nottiMin} notti.`, notti: n, righe: [], totale: 0, ora: 0, dopo: 0 };
	if (regole.nottiMax && n > regole.nottiMax) return { ok: false, errore: `Per soggiorni oltre le ${regole.nottiMax} notti scrivici.`, notti: n, righe: [], totale: 0, ora: 0, dopo: 0 };

	let soggiorno = 0;
	for (let i = 0; i < n; i++) soggiorno += prezzoNotte(casa, piuChiave(r.dal, i));
	soggiorno = cent(soggiorno);
	const media = cent(soggiorno / n);
	const righe = [{ id: 'notti', voce: `${n} ${n === 1 ? 'notte' : 'notti'}`, dettaglio: `${euro(media)} a notte${Number.isInteger(media) ? '' : ' in media'}`, importo: soggiorno }];

	const sconto = formula?.sconto ? cent((soggiorno * formula.sconto) / 100) : 0;
	if (sconto) righe.push({ id: 'sconto', voce: `Sconto ${formula.nome}`, dettaglio: `${formula.sconto}% sulle notti`, importo: -sconto });

	const pulizie = casa.prezzo.pulizie || 0;
	if (pulizie) righe.push({ id: 'pulizie', voce: 'Pulizia finale', dettaglio: 'una volta sola', importo: pulizie });

	const t = regole.tassa;
	const nottiTassa = t ? Math.min(n, t.nottiMax || n) : 0;
	const tassa = t ? cent(t.perPersonaNotte * adulti * nottiTassa) : 0;
	if (tassa) righe.push({ id: 'tassa', voce: 'Tassa di soggiorno', dettaglio: `${euro(t.perPersonaNotte)} × ${adulti} ${adulti === 1 ? 'persona' : 'persone'} × ${nottiTassa} ${nottiTassa === 1 ? 'notte' : 'notti'}`, importo: tassa });

	const corsa = transfer?.ok ? transfer.totale : 0;
	if (corsa) righe.push({ id: 'transfer', voce: 'Transfer', dettaglio: transfer.sintesi || '', importo: corsa });

	const totale = cent(soggiorno - sconto + pulizie + tassa + corsa);
	const quota = formula?.quotaOra ?? 1;
	const ora = quota >= 1 ? totale : cent(Math.round(totale * quota));
	return { ok: true, errore: '', notti: n, adulti, righe, soggiorno, sconto, pulizie, tassa, transfer: corsa, totale, ora, dopo: cent(totale - ora) };
}

/* ---------- Corse con autista ---------- */
const notturna = (ora, a) => {
	if (!a?.notte || !/^\d{1,2}:\d{2}$/.test(ora || '')) return false;
	const h = Number(ora.split(':')[0]);
	return a.notte.dalle > a.notte.alle ? h >= a.notte.dalle || h < a.notte.alle : h >= a.notte.dalle && h < a.notte.alle;
};

/**
 * Conto di una corsa.
 * r: { servizio: 'transfer' | 'andata-ritorno' | 'shopping' | 'escursioni', luogo, verso, ora, oraRitorno, ore, passeggeri, conSoggiorno }
 * cfg: { autista, luoghi, negozi, sentieri } da data.js
 * Ritorna { ok, errore, titolo, sintesi, righe, totale }
 */
export function contoCorsa(r, cfg) {
	const a = cfg.autista;
	const niente = (errore) => ({ ok: false, errore, titolo: '', sintesi: '', righe: [], totale: 0 });
	const pass = Number(r.passeggeri) || 1;
	if (pass > a.passeggeriMax) return niente(`Portiamo fino a ${a.passeggeriMax} passeggeri per corsa: per gruppi più grandi scrivici.`);
	const righe = [];
	let titolo = '';
	let sintesi = '';
	const conNotte = (voce, prezzo, ora) => {
		righe.push({ id: `corsa-${righe.length}`, voce, dettaglio: `fino a ${a.passeggeriMax} passeggeri`, importo: prezzo });
		if (notturna(ora, a)) righe.push({ id: `notte-${righe.length}`, voce: 'Corsa notturna', dettaglio: `+${a.notte.maggiorazione}% tra le ${a.notte.dalle} e le ${a.notte.alle}`, importo: cent((prezzo * a.notte.maggiorazione) / 100) });
	};

	if (r.servizio === 'transfer' || r.servizio === 'andata-ritorno') {
		const l = cfg.luoghi.find((x) => x.id === r.luogo);
		if (!l) return niente('Scegli da dove parti o dove vuoi arrivare.');
		const dalLago = r.verso === 'dal-lago';
		const andata = dalLago ? `Dal lago a ${l.breve}` : `Da ${l.breve} al lago`;
		const ritorno = dalLago ? `Da ${l.breve} al lago` : `Dal lago a ${l.breve}`;
		conNotte(andata, l.prezzo, r.ora);
		titolo = r.servizio === 'transfer' ? 'Transfer' : 'Andata e ritorno';
		sintesi = r.servizio === 'transfer' ? andata : `${l.breve}, andata e ritorno`;
		if (r.servizio === 'andata-ritorno') {
			conNotte(ritorno, l.prezzo, r.oraRitorno);
			if (a.scontoRitorno) righe.push({ id: 'sconto-ritorno', voce: 'Sconto sul ritorno', dettaglio: `${a.scontoRitorno}% prenotando insieme`, importo: -cent((l.prezzo * a.scontoRitorno) / 100) });
		}
	} else if (r.servizio === 'shopping') {
		const d = cfg.negozi.find((x) => x.id === r.luogo);
		if (!d) return niente('Scegli dove vuoi andare.');
		const ore = Math.max(d.oreIncluse, Math.min(a.oreMax, Number(r.ore) || d.oreIncluse));
		righe.push({ id: 'giro', voce: d.nome, dettaglio: `andata, ritorno e ${d.oreIncluse} ore sul posto`, importo: d.prezzo });
		if (ore > d.oreIncluse) righe.push({ id: 'ore', voce: `${ore - d.oreIncluse} ${ore - d.oreIncluse === 1 ? 'ora' : 'ore'} in più`, dettaglio: `${euro(a.oraInPiu)} l’ora`, importo: (ore - d.oreIncluse) * a.oraInPiu });
		titolo = 'Shopping con autista';
		sintesi = `${d.nome}, ${ore} ore sul posto`;
	} else if (r.servizio === 'escursioni') {
		const s = cfg.sentieri.find((x) => x.id === r.luogo);
		if (!s) return niente('Scegli da dove parte la tua escursione.');
		righe.push({ id: 'giro', voce: s.nome, dettaglio: 'ti portiamo e ti veniamo a riprendere', importo: s.prezzo });
		titolo = 'Escursione';
		sintesi = `${s.nome}, andata e ripresa`;
	} else {
		return niente('Scegli il servizio.');
	}

	// sconto di chi prenota la corsa insieme al soggiorno (idea di Gian, percentuale in data.js)
	if (r.conSoggiorno && a.scontoConSoggiorno) {
		const base = righe.reduce((s, x) => s + x.importo, 0);
		righe.push({ id: 'sconto-soggiorno', voce: 'Sconto con il soggiorno', dettaglio: `${a.scontoConSoggiorno}% prenotando insieme alla mansarda`, importo: -cent((base * a.scontoConSoggiorno) / 100) });
	}
	const totale = cent(righe.reduce((s, x) => s + x.importo, 0));
	return { ok: true, errore: '', titolo, sintesi, righe, totale };
}

/** Il prezzo più basso di un servizio («Da 70 €») */
export function daCorsa(servizio, cfg) {
	const elenco = servizio === 'shopping' ? cfg.negozi : servizio === 'escursioni' ? cfg.sentieri : cfg.luoghi;
	const min = Math.min(...elenco.map((x) => x.prezzo));
	if (servizio !== 'andata-ritorno') return min;
	return cent(min * 2 - (min * (cfg.autista.scontoRitorno || 0)) / 100);
}

/* ---------- Codice della prenotazione di prova ---------- */
export function codiceProva() {
	const lettere = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let c = '';
	for (let i = 0; i < 5; i++) c += lettere[Math.floor(Math.random() * lettere.length)];
	return `PROVA-${c}`;
}
