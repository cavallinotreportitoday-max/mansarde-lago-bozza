// Riquadri piccoli con le date: la barra della home, il riquadro di lato e la barra in fondo delle pagine
// delle mansarde («Arrivo / Partenza / Ospiti») e dei servizi con autista («Giorno / Passeggeri»).
// Le date scelte qui arrivano già scritte nel percorso di prenotazione (nell'indirizzo della pagina).
import { contoSoggiorno, euro, daNotte, daChiave } from './prezzi.js?v=2';
import { $, $$, dati, memoria, conParametri, corto, quanteNotti, limiti, notteOccupata, soggiornoLibero, dateValide } from './sito.js?v=2';
import { apriCalendario } from './calendario.js?v=2';
import { ravviva } from './tendine.js?v=2';

/* ---------- Soggiorno ---------- */
const box = $('[data-mini="soggiorno"]');
if (box) {
	const slug = box.dataset.casa || '';
	const casa = (dati.mansarde || []).find((m) => m.slug === slug) || null;
	const adultiSel = $('[data-mini-adulti]', box);
	const contoBox = $('[data-mini-conto]');
	const pagina = ($('[data-mini-vai]')?.getAttribute('href') || './prenota.html').split('#')[0];
	const s = { dal: '', al: '', adulti: Number(adultiSel?.value) || 2, ...(memoria.leggi('lago-soggiorno') || {}) };
	// date scadute o non più libere per questa mansarda: si tolgono, non si spostano
	if (!dateValide(s.dal, s.al) || !soggiornoLibero(slug, s.dal, s.al)) s.dal = s.al = '';
	if (adultiSel) adultiSel.value = String(Math.min(Number(s.adulti) || 2, casa?.ospitiMax || 2));

	const aggiorna = () => {
		const piene = Boolean(s.dal && s.al);
		for (const [nome, k] of [['dal', s.dal], ['al', s.al]])
			for (const t of $$(`[data-date-testo="${nome}"]`)) {
				t.textContent = k ? corto(k) : 'Aggiungi data';
				t.closest('button')?.classList.toggle('is-pieno', Boolean(k));
			}
		const scelte = { casa: slug, dal: s.dal, al: s.al, adulti: s.adulti };
		for (const a of $$('[data-mini-vai], [data-mini-vai-link]')) {
			a.setAttribute('href', conParametri(pagina, scelte));
			if (a.matches('[data-mini-vai]') && !a.matches('[data-mini-fisso]')) a.textContent = piene ? 'Prenota' : 'Scegli le date';
		}
		for (const a of $$('[data-mini-transfer]')) a.setAttribute('href', conParametri(pagina, { ...scelte, transfer: 'arrivo' }));
		if (!casa) return;
		// conto con le date scelte: stesso motore del percorso di prenotazione (senza formula e senza transfer)
		const c = piene ? contoSoggiorno({ dal: s.dal, al: s.al, adulti: s.adulti }, casa, dati.regole) : null;
		if (contoBox) {
			contoBox.hidden = !c?.ok;
			if (c?.ok) {
				contoBox.innerHTML = '';
				const dl = document.createElement('dl');
				dl.className = 'pn-righe';
				for (const r of c.righe) {
					const dt = document.createElement('dt');
					dt.textContent = r.voce;
					if (r.dettaglio) dt.append(Object.assign(document.createElement('small'), { textContent: r.dettaglio }));
					const dd = document.createElement('dd');
					dd.textContent = euro(r.importo);
					dl.append(dt, dd);
				}
				const tot = document.createElement('p');
				tot.className = 'pn-totale';
				tot.innerHTML = '<span>Totale</span>';
				tot.append(Object.assign(document.createElement('strong'), { textContent: euro(c.totale) }));
				contoBox.append(dl, tot);
				ravviva(contoBox);
			}
		}
		for (const f of $$('[data-mini-fondo]')) {
			f.innerHTML = '';
			const riga = document.createElement('span');
			const forte = document.createElement('strong');
			if (c?.ok) {
				forte.textContent = euro(c.totale);
				riga.append(forte, ' in tutto');
				f.append(riga, Object.assign(document.createElement('small'), { textContent: `${corto(s.dal)} – ${corto(s.al)} · ${quanteNotti(c.notti)}` }));
			} else {
				forte.textContent = euro(daNotte(casa));
				riga.append('Da ', forte);
				f.append(riga, Object.assign(document.createElement('small'), { textContent: 'a notte' }));
			}
		}
	};

	const scegli = async (parte, chi) => {
		const { min, max } = limiti();
		const esito = await apriCalendario({
			modo: 'intervallo',
			da: s.dal,
			a: s.al,
			parti: parte === 'partenza' ? 'a' : 'da',
			min,
			max,
			libero: (k) => !notteOccupata(slug, k),
			nottiMin: dati.regole?.nottiMin || 1,
			nottiMax: dati.regole?.nottiMax || 28,
			daChi: chi
		});
		if (!esito) return;
		s.dal = esito.da;
		s.al = esito.a;
		memoria.scrivi('lago-soggiorno', { dal: s.dal, al: s.al, adulti: s.adulti });
		aggiorna();
	};

	document.addEventListener('click', (e) => {
		const b = e.target.closest?.('[data-date-apri]');
		if (b) return scegli(b.dataset.dateApri, b);
		// «Scegli le date»: senza date apre il calendario invece di andare avanti
		const vai = e.target.closest?.('[data-mini-vai]');
		if (vai && !(s.dal && s.al) && !e.metaKey && !e.ctrlKey) {
			e.preventDefault();
			scegli('arrivo', vai);
		}
	});
	adultiSel?.addEventListener('change', () => {
		s.adulti = Number(adultiSel.value) || 2;
		memoria.scrivi('lago-soggiorno', { dal: s.dal, al: s.al, adulti: s.adulti });
		aggiorna();
	});
	aggiorna();
}

/* ---------- Corsa con autista ---------- */
const corsa = $('[data-mini="corsa"]');
if (corsa) {
	const servizio = corsa.dataset.servizio;
	const passSel = $('[data-mini-passeggeri]', corsa);
	const pagina = ($('[data-mini-vai]')?.getAttribute('href') || './corsa.html').split('#')[0];
	const a = dati.cfgCorse?.autista || {};
	const s = { giorno: '', passeggeri: Number(passSel?.value) || 2, ...(memoria.leggi('lago-corsa') || {}) };
	const lim = () => limiti(a.anticipoGiorni ?? 1, a.mesiAvanti ?? 12);
	{
		const { min, max } = lim();
		const d = daChiave(s.giorno);
		if (!d || d < min || d > max) s.giorno = '';
	}
	if (passSel) passSel.value = String(Math.min(Number(s.passeggeri) || 2, a.passeggeriMax || 8));
	const aggiorna = () => {
		for (const t of $$('[data-giorno-testo]')) {
			t.textContent = s.giorno ? corto(s.giorno) : 'Aggiungi data';
			t.closest('button')?.classList.toggle('is-pieno', Boolean(s.giorno));
		}
		for (const l of $$('[data-mini-vai]')) l.setAttribute('href', conParametri(pagina, { servizio, giorno: s.giorno, passeggeri: s.passeggeri }));
	};
	document.addEventListener('click', async (e) => {
		const b = e.target.closest?.('[data-giorno-apri]');
		if (!b) return;
		const { min, max } = lim();
		const esito = await apriCalendario({ modo: 'giorno', da: s.giorno, min, max, daChi: b, testi: { inizio: 'Che giorno?', sotto: 'Scegli il giorno della corsa.', salva: 'Salva il giorno', niente: 'Nessun giorno scelto' } });
		if (!esito) return;
		s.giorno = esito.da;
		memoria.scrivi('lago-corsa', { giorno: s.giorno, passeggeri: s.passeggeri });
		aggiorna();
	});
	passSel?.addEventListener('change', () => {
		s.passeggeri = Number(passSel.value) || 1;
		memoria.scrivi('lago-corsa', { giorno: s.giorno, passeggeri: s.passeggeri });
		aggiorna();
	});
	aggiorna();
}
