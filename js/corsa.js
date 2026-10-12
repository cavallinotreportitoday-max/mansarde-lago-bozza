// PERCORSO «CORSA CON AUTISTA»: servizio → percorso → quando e in quanti → dati → pagamento.
// Indipendente dal percorso del soggiorno (prenota.js). Quattro servizi: transfer, andata e ritorno, shopping, escursioni.
// I conti li fa prezzi.js (contoCorsa); in questa versione niente parte verso un server (pagamento.js, MODO 'demo').
import { contoCorsa, euro, daChiave } from './prezzi.js?v=1';
import { $, $$, dati, memoria, parametri, corto, lungo, limiti } from './sito.js?v=1';
import { apriCalendario } from './calendario.js?v=1';
import { avviaPassi, scriviConto, controllaDati, mostraFatto } from './percorso.js?v=1';
import { paga } from './pagamento.js?v=1';

const box = $('[data-corsa]');
const cfg = dati.cfgCorse;
const a = cfg.autista;
const servizi = dati.corse || [];

const arrivo = parametri();
const ricordo = memoria.leggi('lago-corsa') || {};
const lim = () => limiti(a.anticipoGiorni ?? 1, a.mesiAvanti ?? 12);
const giornoOk = (k) => {
	const d = daChiave(k);
	const { min, max } = lim();
	return Boolean(d && d >= min && d <= max);
};
const s = {
	servizio: servizi.some((x) => x.slug === arrivo.servizio) ? arrivo.servizio : '',
	giorno: giornoOk(arrivo.giorno || ricordo.giorno) ? arrivo.giorno || ricordo.giorno : '',
	ritorno: '',
	passeggeri: Math.max(1, Math.min(a.passeggeriMax, Number(arrivo.passeggeri || ricordo.passeggeri) || 2))
};

const campo = (nome) => $(`[name="${nome}"]`, box);
const valore = (nome) => (campo(nome)?.value || '').trim();
const scelto = (nome) => $(`[name="${nome}"]:checked`, box)?.value || '';
const ar = () => s.servizio === 'andata-ritorno';
const nomeServizio = () => servizi.find((x) => x.slug === s.servizio)?.nome || '';
// il posto scelto, secondo il servizio
const luogo = () => (s.servizio === 'shopping' ? valore('negozi') : s.servizio === 'escursioni' ? valore('sentieri') : valore('luogo'));
// andata e ritorno: si parte dal lago e si torna al lago
const verso = () => (ar() ? 'dal-lago' : scelto('verso') || 'al-lago');

const conto = () => {
	if (!s.servizio) return { ok: false, errore: '' };
	return contoCorsa({ servizio: s.servizio, luogo: luogo(), verso: verso(), ora: valore('ora'), oraRitorno: ar() ? valore('oraRitorno') : '', ore: valore('ore'), passeggeri: s.passeggeri }, cfg);
};

/* ---------- Schermo ---------- */
const riep = $('[data-riepilogo]', box);
const fondoTesto = $('[data-pn-fondo-testo]');
const quando = () => {
	if (!s.giorno) return 'Giorno da scegliere';
	const ora = valore('ora');
	const base = `${corto(s.giorno)}${ora ? ', ore ' + ora : ''}`;
	if (ar() && s.ritorno) return `${base} · ritorno ${s.ritorno === s.giorno ? '' : corto(s.ritorno) + ' '}${valore('oraRitorno') ? 'ore ' + valore('oraRitorno') : ''}`.trim();
	return base;
};
const aggiorna = () => {
	// gruppi di domande che valgono solo per alcuni servizi
	for (const g of $$('[data-per]', box)) g.hidden = !s.servizio || !g.dataset.per.split(' ').includes(s.servizio);
	// percorso: l'etichetta del posto cambia con la direzione
	const et = $('[data-luogo-etichetta]', box);
	if (et) et.textContent = ar() ? 'Dove vuoi andare?' : verso() === 'dal-lago' ? 'Dove vuoi arrivare?' : 'Da dove parti?';
	// shopping: le ore comprese dipendono dalla meta
	const meta = cfg.negozi.find((n) => n.id === valore('negozi'));
	const ore = campo('ore');
	if (meta && ore) {
		ore.min = String(meta.oreIncluse);
		if (Number(ore.value) < meta.oreIncluse) ore.value = String(meta.oreIncluse);
		$('[data-ore-aiuto]', box).textContent = `${meta.oreIncluse} ore sono comprese. Ogni ora in più ${euro(a.oraInPiu)}.`;
	}
	// quando: il ritorno c'è solo per l'andata e ritorno; l'escursione ha l'ora della ripresa
	$('[data-solo-ar]', box).hidden = !ar();
	$('[data-solo-ritorno]', box).hidden = !(ar() || s.servizio === 'escursioni');
	$('[data-giorno-etichetta="giorno"]', box).textContent = ar() ? 'Andata' : 'Giorno';
	$('[data-ora-etichetta]', box).textContent = s.servizio === 'escursioni' || s.servizio === 'shopping' ? 'A che ora partiamo?' : ar() ? 'A che ora l’andata?' : verso() === 'al-lago' ? 'A che ora arrivi?' : 'A che ora partiamo?';
	$('[data-ora-ritorno-etichetta]', box).textContent = s.servizio === 'escursioni' ? 'A che ora ti riprendiamo?' : 'A che ora il ritorno?';
	for (const [nome, k] of [['giorno', s.giorno], ['ritorno', s.ritorno]])
		for (const t of $$(`[data-giorno-testo="${nome}"]`, box)) {
			t.textContent = k ? corto(k) : 'Aggiungi data';
			t.closest('button')?.classList.toggle('is-pieno', Boolean(k));
		}
	// conto di lato
	const c = conto();
	scriviConto(riep, c);
	$('[data-riep-casa]', riep).hidden = !s.servizio;
	if (s.servizio) {
		const icona = $(`[data-icona-servizio="${s.servizio}"]`);
		$('[data-riep-icona]', riep).innerHTML = icona ? icona.innerHTML : '';
		$('[data-riep-nome]', riep).textContent = c.ok ? c.sintesi : nomeServizio();
		$('[data-riep-quando]', riep).textContent = `${quando()} · ${s.passeggeri} ${s.passeggeri === 1 ? 'passeggero' : 'passeggeri'}`;
	}
	if (fondoTesto) {
		fondoTesto.innerHTML = '';
		const riga = document.createElement('span');
		if (c.ok) {
			riga.append(Object.assign(document.createElement('strong'), { textContent: euro(c.totale) }), ' in tutto');
			fondoTesto.append(riga, Object.assign(document.createElement('small'), { textContent: nomeServizio() }));
		} else {
			riga.textContent = 'La tua corsa';
			fondoTesto.append(riga, Object.assign(document.createElement('small'), { textContent: s.servizio ? 'Scegli il percorso' : 'Scegli il servizio' }));
		}
	}
	passi?.riassumi();
};

/* ---------- Passi ---------- */
const passi = avviaPassi(box, {
	valida(id) {
		if (id === 'servizio') return s.servizio ? '' : 'Scegli il servizio.';
		if (id === 'percorso') {
			const c = conto();
			if (!c.ok) return c.errore;
			if (s.servizio === 'transfer' || ar()) return valore('lago').length >= 3 ? '' : 'Scrivi dove sul lago: paese e indirizzo, o il nome dell’albergo.';
			if (s.servizio === 'shopping') return valore('partenzaShopping').length >= 3 ? '' : 'Scrivi dove ti veniamo a prendere.';
			return valore('partenzaEscursione').length >= 3 ? '' : 'Scrivi dove ti veniamo a prendere.';
		}
		if (id === 'quando') {
			if (!giornoOk(s.giorno)) return 'Scegli il giorno.';
			if (ar() && !s.ritorno) return 'Scegli il giorno del ritorno.';
			if (!valore('ora')) return 'Indica l’ora.';
			if ((ar() || s.servizio === 'escursioni') && !valore('oraRitorno')) return s.servizio === 'escursioni' ? 'Indica a che ora ti riprendiamo.' : 'Indica l’ora del ritorno.';
			if ((s.servizio === 'escursioni' || (ar() && s.ritorno === s.giorno)) && valore('oraRitorno') <= valore('ora')) return 'L’ora del ritorno deve essere dopo quella della partenza.';
			const c = conto();
			return c.ok ? '' : c.errore;
		}
		if (id === 'dati') return controllaDati(box);
		if (id === 'paga') return conto().ok ? '' : 'Controlla servizio e percorso.';
		return '';
	},
	sintesi(id) {
		const c = conto();
		if (id === 'servizio') return nomeServizio();
		if (id === 'percorso') return c.ok ? c.sintesi : '';
		if (id === 'quando') return `${quando()} · ${s.passeggeri} ${s.passeggeri === 1 ? 'passeggero' : 'passeggeri'}`;
		if (id === 'dati') return [valore('nome'), valore('email')].filter(Boolean).join(' · ');
		if (id === 'paga') return c.ok ? euro(c.totale) : '';
		return '';
	},
	async alFine(pulsante) {
		const c = conto();
		if (!c.ok) return;
		const esito = await paga({ importo: c.totale, descrizione: c.titolo }, pulsante);
		if (esito === 'rifiutato') return passi.segnaErrore('paga', 'Pagamento di prova rifiutato: nessun addebito. Puoi riprovare.');
		if (esito !== 'pagato') return;
		memoria.togli('lago-corsa');
		mostraFatto({
			box,
			titolo: 'Corsa di prova prenotata',
			righe: [
				['Servizio', c.titolo],
				['Percorso', c.sintesi],
				['Quando', `${lungo(s.giorno)}, ore ${valore('ora')}${ar() ? ` · ritorno ${lungo(s.ritorno)}, ore ${valore('oraRitorno')}` : s.servizio === 'escursioni' ? ` · ripresa alle ${valore('oraRitorno')}` : ''}`],
				['Passeggeri', String(s.passeggeri)],
				['Totale', euro(c.totale)]
			],
			pagato: c.totale
		});
	}
});

/* ---------- Comandi ---------- */
const scegliGiorno = async (quale, chi) => {
	const { min, max } = lim();
	const testi = ar()
		? { inizio: 'Quando parti?', fine: 'Quando torni?', fatto: 'Andata e ritorno', sotto: 'Il ritorno può essere lo stesso giorno: tocca due volte la stessa data.', primo: 'Andata', secondo: 'Ritorno', unita: (n) => (n === 0 ? 'in giornata' : `${n} ${n === 1 ? 'giorno' : 'giorni'} dopo`), salva: 'Salva i giorni', niente: 'Nessun giorno scelto' }
		: { inizio: 'Che giorno?', sotto: 'Scegli il giorno della corsa.', salva: 'Salva il giorno', niente: 'Nessun giorno scelto' };
	const esito = await apriCalendario(ar() ? { modo: 'intervallo', da: s.giorno, a: s.ritorno, parti: quale === 'ritorno' ? 'a' : 'da', min, max, nottiMin: 0, nottiMax: 60, testi, daChi: chi } : { modo: 'giorno', da: s.giorno, min, max, testi, daChi: chi });
	if (!esito) return;
	s.giorno = esito.da;
	s.ritorno = esito.a || '';
	memoria.scrivi('lago-corsa', { giorno: s.giorno, passeggeri: s.passeggeri });
	aggiorna();
};
box.addEventListener('click', (e) => {
	const b = e.target.closest('[data-giorno-apri]');
	if (b) scegliGiorno(b.dataset.giornoApri, b);
});
box.addEventListener('change', (e) => {
	if (e.target.name === 'servizio') {
		s.servizio = e.target.value;
		s.ritorno = '';
		// cambiato il servizio, percorso e orari vanno riguardati
		passi.rifai('percorso', 'quando', 'paga');
	}
	aggiorna();
});
box.addEventListener('input', (e) => {
	if (e.target.name === 'passeggeri') {
		s.passeggeri = Math.max(1, Math.min(a.passeggeriMax, Number(e.target.value) || 1));
		memoria.scrivi('lago-corsa', { giorno: s.giorno, passeggeri: s.passeggeri });
	}
	if (['passeggeri', 'ore', 'ora', 'oraRitorno'].includes(e.target.name)) aggiorna();
});
$('[data-pn-continua]')?.addEventListener('click', () => riep.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));

// valori di partenza nei campi
if (campo('passeggeri')) campo('passeggeri').value = String(s.passeggeri);
for (const r of $$('[name="servizio"]', box)) r.checked = r.value === s.servizio;
aggiorna();
// arrivando da una pagina di servizio il primo passo è già fatto: si riparte dal percorso
if (s.servizio) $('[data-passo="servizio"] [data-passo-avanti]', box).click();
