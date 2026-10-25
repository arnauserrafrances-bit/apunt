// Qüestionari per fer l'informe d'un alumne. Basat en el qüestionari real d'una tutora de 5è
// (blocs 1-4 i 7, i el model de preguntes de l'àmbit lingüístic). El de matemàtiques segueix
// el mateix patró i els criteris d'avaluació de 5è. No cal respondre totes les preguntes.

export interface QuestionBlock {
  id: string;
  name: string;
  subtitle: string;
  sections: { title?: string; questions: { id: string; text: string }[] }[];
}

function block(id: string, name: string, subtitle: string, sections: [string | undefined, string[]][]): QuestionBlock {
  return {
    id,
    name,
    subtitle,
    sections: sections.map(([title, qs], si) => ({
      title,
      questions: qs.map((text, qi) => ({ id: `${id}.${si + 1}.${qi + 1}`, text })),
    })),
  };
}

export const QUESTIONNAIRE: QuestionBlock[] = [
  block("q-adaptacio", "Adaptació al curs i actitud", "Actitud a l'escola i relació amb el professorat", [
    [undefined, [
      "Com arriba al matí? Ve content/a, tranquil/a i amb ganes d'aprendre?",
      "Com s'ha adaptat a les rutines, els canvis i les exigències de 5è?",
      "Participa en les activitats i mostra interès pels aprenentatges?",
      "Respecta les normes de l'aula i els torns de paraula? Necessita recordatoris?",
      "Com és la seva relació amb el professorat? Pregunta quan té dubtes?",
      "Accepta les indicacions i les correccions? Mostra voluntat de millorar?",
    ]],
  ]),
  block("q-habits", "Autonomia, responsabilitat i hàbits de treball", "Organització i realització de les tasques escolars", [
    [undefined, [
      "Comença les activitats de manera autònoma o necessita ajuda i confirmació?",
      "Manté l'atenció i la concentració? Es distreu fàcilment?",
      "Com és el seu ritme de treball? Acaba les activitats dins del temps previst?",
      "És constant i perseverant davant les dificultats?",
      "Fa servir correctament l'agenda, presenta els deures i recorda les feines pendents?",
      "Organitza bé la motxilla, el material i el seu espai de treball?",
      "Té cura de la lletra, l'ordre i la presentació de les feines? Les revisa abans d'entregar-les?",
    ]],
  ]),
  block("q-emocional", "Desenvolupament personal i emocional", "Seguretat personal i gestió de les emocions", [
    [undefined, [
      "Com es mostra emocionalment a l'escola?",
      "Confia en les seves capacitats o manifesta inseguretats i necessita aprovació?",
      "Com reacciona davant els errors, les correccions i la frustració?",
      "Sap expressar allò que sent, li preocupa o necessita? Demana ajuda?",
      "Quan s'enfada o s'inquieta, com recupera la calma? Quin acompanyament li funciona?",
      "Mostra impulsivitat o dificultats per esperar, dialogar o controlar les reaccions?",
      "Has observat progressos en la seva maduresa i autonomia emocional?",
    ]],
  ]),
  block("q-convivencia", "Convivència i relacions socials", "Amistats, integració i relacions amb el grup", [
    [undefined, [
      "Se sent integrat/da al grup? Té amistats estables?",
      "Com participa en els jocs de pati i les activitats compartides?",
      "Com gestiona els desacords i els conflictes? Dialoga i demana ajuda quan cal?",
      "Mostra respecte i empatia envers els companys?",
      "Com treballa en equip? Escolta, col·labora i respecta les aportacions dels altres?",
      "Té alguna responsabilitat o càrrec dins del grup? Com l'assumeix?",
      "Quines qualitats personals aporta al bon funcionament de la classe?",
    ]],
  ]),
  block("q-linguistic", "Àmbit lingüístic", "Expressió oral i escrita, lectura i comprensió lectora", [
    ["Expressió oral", [
      "Participa espontàniament a classe o necessita que se l'animi?",
      "S'expressa amb claredat i organitza bé les idees quan parla?",
      "Utilitza un vocabulari ric i adequat a la situació?",
      "Escolta els altres i respecta els torns de paraula?",
    ]],
    ["Expressió escrita", [
      "Redacta textos coherents, amb les idees ben ordenades i connectades?",
      "Estructura els textos en paràgrafs i utilitza un vocabulari variat?",
      "Com és la seva ortografia? Quins aspectes necessita reforçar?",
      "Com són la cal·ligrafia i la presentació de les feines?",
      "Revisa els seus escrits i corregeix les errades quan se li indiquen?",
      "Barreja el català i el castellà o presenta dificultats específiques en alguna llengua?",
    ]],
    ["Lectura", [
      "Llegeix amb fluïdesa i correcció o encara presenta dificultats?",
      "Respecta els signes de puntuació i utilitza una entonació adequada?",
      "Dona expressivitat a la lectura i interpreta el sentit del text quan llegeix en veu alta?",
      "Té hàbit lector? Completa i entrega les activitats o fitxes de lectura?",
    ]],
    ["Comprensió lectora", [
      "Comprèn la informació explícita dels textos que llegeix?",
      "Identifica les idees principals i sap resumir el contingut?",
      "Fa inferències i interpreta la informació que no apareix directament al text?",
      "Respon les preguntes de comprensió amb precisió i autonomia?",
    ]],
  ]),
  block("q-matematic", "Àmbit matemàtic, geometria i mesura", "Assoliment dels continguts del trimestre", [
    ["Raonament i resolució de problemes", [
      "Observa i fa deduccions per dissenyar estratègies sistemàtiques i ordenades?",
      "Comprèn els enunciats dels problemes i identifica les operacions necessàries?",
      "Sap explicar com ha resolt un problema i comprova si el resultat té sentit?",
      "Resol els problemes amb autonomia o necessita orientació i acompanyament?",
    ]],
    ["Numeració i estimació", [
      "Comprèn la numeració i el valor de posició dels nombres de quatre o més xifres?",
      "Aprofita la representació d'intervals a la línia numèrica per fer estimacions i arrodonir?",
    ]],
    ["Càlcul i operacions", [
      "Quin domini té de la multiplicació? Entén l'algoritme? Comet errors de càlcul?",
      "Comprèn la divisió i la relació entre multiplicació i divisió com a operacions inverses?",
      "Aprofita les propietats de les operacions i detecta patrons en les multiplicacions?",
      "Calcula amb precisió i revisa els resultats?",
    ]],
    ["Geometria i mesura", [
      "Reconeix i descriu figures, simetries i cossos geomètrics?",
      "Utilitza el vocabulari d'espai i forma i interpreta les coordenades?",
      "Com treballa les mesures i la percepció espacial?",
    ]],
    ["Actitud i suport", [
      "Mostra interès i perseverança davant les activitats matemàtiques?",
      "Quins continguts ha consolidat i quins necessita reforçar? Quin tipus d'ajuda li resulta útil?",
    ]],
  ]),
  block("q-valoracio", "Valoració final i objectius de millora", "Fortaleses, progressos i prioritats per al trimestre vinent", [
    [undefined, [
      "Quines són les principals qualitats o fortaleses de l'alumne/a?",
      "Quins progressos significatius ha fet durant aquest trimestre?",
      "Quins aspectes consideres prioritaris per al trimestre vinent?",
      "Quines orientacions o rutines poden ajudar-lo/la a continuar avançant?",
      "Hi ha alguna observació important que no hagi quedat recollida en els blocs anteriors?",
    ]],
  ]),
];

export const ALL_QUESTIONS = QUESTIONNAIRE.flatMap((b) =>
  b.sections.flatMap((s) => s.questions.map((q) => ({ ...q, blockId: b.id, section: s.title }))),
);
export const BLOCK_BY_ID = new Map(QUESTIONNAIRE.map((b) => [b.id, b]));
