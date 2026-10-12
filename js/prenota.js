// PERCORSO «SOGGIORNO»: date e mansarda → ospiti → transfer (facoltativo) → dati → pagamento.
// Indipendente dal percorso delle corse (corsa.js); il transfer si può aggiungere qui dentro al soggiorno.
// I conti li fa prezzi.js; in questa versione niente parte verso un server (pagamento.js, MODO 'demo').
import { contoSoggiorno, contoCorsa, euro, piuChiave, daNotte, libera, formulaAmmessa, conAnticipo } from './prezzi.js?v=1';
import { $, $$, dati, memoria, parametri, corto, lungo, quanteNotti, limiti, notteOccupata, soggiornoLibero, dateValide, occupate } from './sito.js?v=1';
import { apriCalendario } from './calendario.js?v=1';
import { avviaPassi, scriviConto, controllaDati, mostraFatto } from './percorso.js?v=1';
import { paga } from './pagamento.js?v=1';

const box = $('[data-prenota]');
const reg = dati.regole || {};
const case_ = dati.mansarde || [];
const cfg = dati.cfgCorse;
const conTransfer = Boolean(dati.autistaAttivo && $('[data-passo="transfer"]', box));

// scelte: dall'indirizzo (arrivando da una pagina) e dalla memoria della visita
const arrivo = parametri();
const ricordo = memoria.leggi('lago-soggiorno') || {};
const s = {
	dal: arrivo.dal || ricordo.dal || '',
	al: arrivo.al || ricordo.al || '',
	casa: case_.some((m) => m.slug === arrivo.casa) ? arrivo.casa : '',
	adulti: Math.max(1, Math.min(2, Number(arrivo.adulti || ricordo.adulti) || 2)),
	transfer: conTransfer && ['arrivo', 'andata-ritorno'].includes(arrivo.transfer) ? arrivo.transfer : 'no'
};
if (!dateValide(s.dal, s.al) || !soggiornoLibero(s.casa, s.dal, s.al)) s.dal = s.al = '';

const campo = (nome) => $(`[name="${nome}"]`, box);
const valore = (nome) => (campo(nome)?.value || '').trim();
const scelto = (nome) => $(`[name="${nome}"]:checked`, box)?.value || '';
const casa = () => case_.find((m) => m.slug === s.casa) || null;
const formula = () => (dati.formule || []).find((f) => f.id === scelto('formula')) || dati.formule?.[0] || null;

/* ---------- Conti ---------- */
const contoTransfer = () => {
	if (!conTransfer || s.transfer === 'no') return null;
	return contoCorsa({ servizio: s.transfer === 'arrivo' ? 'transfer' : 'andata-ritorno', luogo: valore('luogo'), verso: 'al-lago', ora: valore('ora'), oraRitorno: valore('oraRitorno'), passeggeri: s.adulti, conSoggiorno: true }, cfg);
};
const conto = (f = formula()) => {
	const c = casa();
	if (!c) return { ok: false, errore: s.dal && s.al ? 'Scegli la mansarda: qui vedi il conto, voce per voce.' : '' };
	return contoSoggiorno({ dal: s.dal, al: s.al, adulti: s.adulti }, c, reg, f, contoTransfer());
};

/* ---------- Schermo ---------- */
const riep = $('[data-riepilogo]', box);
const fondoTesto = $('[data-pn-fondo-testo]');
const aggiorna = () => {
	const piene = Boolean(s.dal && s.al);
	for (const [nome, k] of [['dal', s.dal], ['al', s.al]])
		for (const t of $$(`[data-date-testo="${nome}"]`, box)) {
			t.textContent = k ? corto(k) : 'Aggiungi data';
			t.closest('button')?.classList.toggle('is-pieno', Boolean(k));
		}
	// le due mansarde: prezzo per le date scelte, oppure «non disponibile»
	for (const m of case_) {
		const libera_ = !piene || libera(occupate(m.slug), s.dal, s.al);
		const etichetta = $(`[data-casa-scelta="${m.slug}"]`, box);
		const radio = $('input', etichetta);
		radio.disabled = !libera_;
		etichetta.classList.toggle('is-occupata', !libera_);
		if (!libera_ && s.casa === m.slug) s.casa = '';
		radio.checked = s.casa === m.slug;
		const pr = $(`[data-casa-prezzo="${m.slug}"]`, box);
		if (!libera_) pr.textContent = 'Non disponibile in queste date';
		else if (piene) {
			const c = contoSoggiorno({ dal: s.dal, al: s.al, adulti: s.adulti }, m, reg);
			pr.textContent = c.ok ? `${euro(c.soggiorno)} per ${quanteNotti(c.notti)}` : `Da ${euro(daNotte(m))} a notte`;
		} else pr.textContent = `Da ${euro(daNotte(m))} a notte`;
	}
	// transfer: dettagli e prezzo
	if (conTransfer) {
		$('[data-transfer-dettagli]', box).hidden = s.transfer === 'no';
		$('[data-solo-ritorno]', box).hidden = s.transfer !== 'andata-ritorno';
		const t = contoTransfer();
		$('[data-transfer-prezzo]', box).textContent = t?.ok ? `${t.sintesi}: ${euro(t.totale)} con lo sconto del ${cfg.autista.scontoConSoggiorno}%, per tutta la vettura.` : '';
	}
	// formule: quanto si paga ora con ognuna. Con l'arrivo vicino l'acconto non si può scegliere e la cancellazione
	// gratuita non c'è più: lo scriviamo, e la scelta torna alla prima formula possibile
	const lontano = !s.dal || conAnticipo(s.dal, reg);
	for (const f of dati.formule || []) {
		const ammessa = !s.dal || formulaAmmessa(f, s.dal, reg);
		const radio = $(`[name="formula"][value="${f.id}"]`, box);
		radio.disabled = !ammessa;
		radio.closest('[data-formula]').classList.toggle('is-spenta', !ammessa);
		if (!ammessa && radio.checked) $$('[name="formula"]', box).find((r) => !r.disabled).checked = true;
		$(`[data-formula-testo="${f.id}"]`, box).textContent = !lontano && f.testoVicino ? f.testoVicino : f.testo;
	}
	for (const f of dati.formule || []) {
		const c = conto(f);
		const el = $(`[data-formula-importo="${f.id}"]`, box);
		if (el) el.textContent = c.ok && formulaAmmessa(f, s.dal, reg) ? (c.dopo ? `${euro(c.ora)} ora` : euro(c.totale)) : '';
	}
	// conto di lato
	const c = conto();
	scriviConto(riep, c);
	const m = casa();
	$('[data-riep-casa]', riep).hidden = !m;
	if (m) {
		const f = $('[data-riep-foto]', riep);
		if (f.dataset.casa !== m.slug) {
			f.dataset.casa = m.slug;
			// foto provvisoria che non arriva: l'illustrazione che sta nel sito
			f.onerror = () => {
				f.onerror = null;
				f.src = m.fotoRiserva;
			};
			f.src = m.foto;
		}
		$('[data-riep-nome]', riep).textContent = `${m.nome}, ${m.luogo}`;
		$('[data-riep-quando]', riep).textContent = piene ? `${corto(s.dal)} – ${corto(s.al)} · ${s.adulti} ${s.adulti === 1 ? 'ospite' : 'ospiti'}` : 'Date da scegliere';
	}
	const ora = $('[data-riep-ora]', riep);
	ora.hidden = !(c.ok && c.dopo);
	if (c.ok && c.dopo) ora.textContent = `Paghi ora ${euro(c.ora)}. Il resto, ${euro(c.dopo)}, entro ${lungo(piuChiave(s.dal, -(reg.cancellazioneGiorni || 7)))}.`;
	if (fondoTesto) {
		fondoTesto.innerHTML = '';
		const riga = document.createElement('span');
		if (c.ok) {
			riga.append(Object.assign(document.createElement('strong'), { textContent: euro(c.totale) }), ' in tutto');
			fondoTesto.append(riga, Object.assign(document.createElement('small'), { textContent: `${quanteNotti(c.notti)}${c.transfer ? ' · con transfer' : ''}` }));
		} else {
			riga.textContent = 'Il tuo soggiorno';
			fondoTesto.append(riga, Object.assign(document.createElement('small'), { textContent: piene ? 'Scegli la mansarda' : 'Scegli le date' }));
		}
	}
	passi?.riassumi();
};

/* ---------- Passi ---------- */
const luogoNome = () => cfg.luoghi.find((l) => l.id === valore('luogo'))?.breve || '';
const passi = avviaPassi(box, {
	valida(id) {
		if (id === 'date') {
			if (!s.dal || !s.al) return 'Scegli le date di arrivo e di partenza.';
			if (!dateValide(s.dal, s.al)) return 'Queste date non si possono più prenotare: scegline altre.';
			if (!casa()) return 'Scegli la mansarda.';
			if (!libera(occupate(s.casa), s.dal, s.al)) return 'In queste date la mansarda non è disponibile: cambia date o mansarda.';
			return '';
		}
		if (id === 'ospiti') return s.adulti >= 1 && s.adulti <= (casa()?.ospitiMax || 2) ? '' : 'Le mansarde ospitano fino a 2 persone.';
		if (id === 'transfer') {
			const t = contoTransfer();
			return !t || t.ok ? '' : t.errore;
		}
		if (id === 'dati') return controllaDati(box);
		if (id === 'paga') return !conto().ok ? 'Controlla date e mansarda.' : formulaAmmessa(formula(), s.dal, reg) ? '' : 'Scegli come vuoi pagare.';
		return '';
	},
	sintesi(id) {
		const m = casa();
		if (id === 'date') return m && s.dal ? `${m.nome} · ${corto(s.dal)} – ${corto(s.al)}` : '';
		if (id === 'ospiti') return `${s.adulti} ${s.adulti === 1 ? 'ospite' : 'ospiti'}${campo('bimbo')?.checked ? ' e un bimbo' : ''}`;
		if (id === 'transfer') {
			const t = contoTransfer();
			return t?.ok ? `${s.transfer === 'arrivo' ? 'Solo all’arrivo' : 'Arrivo e ripartenza'}, ${luogoNome()} · ${euro(t.totale)}` : 'No, grazie';
		}
		if (id === 'dati') return [valore('nome'), valore('email')].filter(Boolean).join(' · ');
		if (id === 'paga') return formula()?.nome || '';
		return '';
	},
	async alFine(pulsante) {
		const c = conto();
		if (!c.ok) return;
		const m = casa();
		const esito = await paga({ importo: c.ora, descrizione: `${m.nome}, ${quanteNotti(c.notti)}` }, pulsante);
		if (esito === 'rifiutato') return passi.segnaErrore('paga', 'Pagamento di prova rifiutato: nessun addebito. Puoi riprovare.');
		if (esito !== 'pagato') return;
		const t = contoTransfer();
		memoria.togli('lago-soggiorno');
		mostraFatto({
			box,
			titolo: 'Prenotazione di prova completata',
			righe: [
				['Mansarda', `${m.nome}, ${m.luogo}`],
				['Date', `${lungo(s.dal)} – ${lungo(s.al)} (${quanteNotti(c.notti)})`],
				['Ospiti', `${s.adulti}${campo('bimbo')?.checked ? ' e un bimbo fino a 2 anni' : ''}`],
				['Transfer', t?.ok ? `${t.sintesi} · ${euro(t.totale)}` : ''],
				['Formula', formula()?.nome || ''],
				['Totale', euro(c.totale)]
			],
			pagato: c.ora
		});
	}
});
if (!conTransfer) passi.mostra('transfer', false);

/* ---------- Comandi ---------- */
const scegliDate = async (parte, chi) => {
	const { min, max } = limiti();
	const esito = await apriCalendario({
		modo: 'intervallo',
		da: s.dal,
		a: s.al,
		parti: parte === 'partenza' ? 'a' : 'da',
		min,
		max,
		// con una mansarda già scelta si vedono i suoi giorni liberi; senza, quelli in cui ne è libera almeno una
		libero: (k) => !notteOccupata(s.casa, k),
		nottiMin: reg.nottiMin || 1,
		nottiMax: reg.nottiMax || 28,
		daChi: chi
	});
	if (!esito) return;
	s.dal = esito.da;
	s.al = esito.a;
	memoria.scrivi('lago-soggiorno', { dal: s.dal, al: s.al, adulti: s.adulti });
	aggiorna();
};
box.addEventListener('click', (e) => {
	const b = e.target.closest('[data-date-apri]');
	if (b) scegliDate(b.dataset.dateApri, b);
});
box.addEventListener('change', (e) => {
	const n = e.target.name;
	if (n === 'casa') s.casa = e.target.value;
	if (n === 'transfer') s.transfer = e.target.value;
	aggiorna();
});
box.addEventListener('input', (e) => {
	if (e.target.name === 'adulti') {
		s.adulti = Math.max(1, Math.min(2, Number(e.target.value) || 1));
		memoria.scrivi('lago-soggiorno', { dal: s.dal, al: s.al, adulti: s.adulti });
		aggiorna();
	}
});
// telefono: «Vedi il conto» porta al riepilogo
$('[data-pn-continua]')?.addEventListener('click', () => riep.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));

// valori di partenza nei campi
if (campo('adulti')) campo('adulti').value = String(s.adulti);
for (const r of $$('[name="transfer"]', box)) r.checked = r.value === s.transfer;
aggiorna();
// arrivando con date e mansarda già scelte (da una pagina del sito) il primo passo è già fatto: si riparte dagli ospiti
if (s.casa && s.dal && s.al && !arrivo.fermo) $('[data-passo="date"] [data-passo-avanti]', box).click();
