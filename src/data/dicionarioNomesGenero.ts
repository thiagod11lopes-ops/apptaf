/**
 * Dicionário de primeiros nomes brasileiros → sexo biológico (M/F).
 * Chaves devem estar normalizadas (minúsculas, sem acento).
 */
export type GeneroNome = 'M' | 'F';

const MASCULINOS = [
  'aaron', 'abdiel', 'abel', 'abilio', 'abner', 'abraao', 'adalberto', 'adalton', 'adam', 'adelson', 'ademar',
  'ademir', 'adesio', 'adilson', 'adolfo', 'adonis', 'adrian', 'adriano', 'aecio', 'afonso', 'agnaldo',
  'agnelo', 'agostinho', 'aguinaldo', 'airton', 'alan', 'alberto', 'alcides', 'aldecir', 'aldenir', 'aldo',
  'aleandro', 'alejandro', 'alenilson', 'alex', 'alexander', 'alexandre', 'alexsandro', 'alfredo', 'alison', 'alisson',
  'allan', 'almir', 'aloizio', 'alonso', 'alvaro', 'alvino', 'amadeu', 'amado', 'amarildo', 'amazonas',
  'americo', 'amilcar', 'amilton', 'amir', 'anacleto', 'anderson', 'andre', 'andrei', 'andrew', 'angelo',
  'anisio', 'anselmo', 'anthony', 'antonio', 'apolinario', 'apolo', 'araldo', 'ariel', 'aristides', 'aristoteles',
  'arlindo', 'armando', 'arnaldo', 'arthur', 'artur', 'ary', 'assuncao', 'atila', 'augusto', 'aurelio',
  'auro', 'axel', 'ayrton', 'baltazar', 'bartolomeu', 'basilio', 'benedito', 'benicio', 'benjamin', 'benjamim',
  'bento', 'bernardino', 'bernardo', 'beto', 'billy', 'boaventura', 'boris', 'brandon', 'braulio', 'brenno',
  'brennon', 'brenon', 'brian', 'bruce', 'bruno', 'bryan', 'caetano', 'caio', 'caito', 'calebe',
  'calixto', 'camilo', 'caua', 'cauan', 'cecilio', 'cedric', 'celio', 'celso', 'cesar', 'charles',
  'christian', 'christopher', 'cicero', 'cid', 'cirilo', 'claudemir', 'claudio', 'clayton', 'cleber', 'cledson',
  'cleiton', 'clemerson', 'clementino', 'cleudson', 'clodoaldo', 'clovis', 'conrado', 'constantino', 'cosmo', 'cristiano',
  'cristovao', 'cruz', 'cunha', 'dacio', 'dagoberto', 'dalmo', 'dalton', 'damiao', 'daniel', 'danilo',
  'dante', 'dario', 'davi', 'david', 'davison', 'decio', 'deivid', 'demerson', 'demetrio', 'denilson',
  'denis', 'dennis', 'deoclides', 'deon', 'derek', 'diego', 'diogo', 'dionisio', 'dirceu', 'djalma',
  'domingos', 'donato', 'douglas', 'durval', 'dylan', 'ederson', 'edgar', 'edimilson', 'edison', 'edivaldo',
  'edmilson', 'edmir', 'edmundo', 'ednaldo', 'edson', 'eduardo', 'edward', 'edwin', 'egidio', 'elano',
  'elias', 'eliezer', 'elio', 'eliseu', 'elison', 'elivelton', 'eloi', 'elton', 'elzio', 'emanoel',
  'emanuel', 'emerson', 'emiliano', 'emilio', 'enio', 'enoch', 'enzo', 'erick', 'erik', 'erminio',
  'ernani', 'ernesto', 'eronaldo', 'eroni', 'esdras', 'estevam', 'estevao', 'etore', 'euclides', 'eugenio',
  'eurico', 'evaldo', 'evandro', 'evaristo', 'evelacio', 'everson', 'everton', 'ezequiel', 'fabiano', 'fabio',
  'fabricio', 'faustino', 'fausto', 'felipe', 'felix', 'fernando', 'filipe', 'flavio', 'florian', 'floriano',
  'francisco', 'franco', 'frank', 'franklin', 'fred', 'frederico', 'gabriel', 'gael', 'galileu', 'gastao',
  'genezio', 'genilson', 'genival', 'genivaldo', 'george', 'geraldo', 'germano', 'gerson', 'gerald', 'getulio',
  'gil', 'gilberto', 'gildo', 'giliard', 'gilmar', 'gilson', 'giovani', 'giovanni', 'glaucio', 'goncalo',
  'gregorio', 'guilherme', 'gustavo', 'hamilton', 'haroldo', 'heitor', 'helder', 'heli', 'helio', 'helton',
  'henrique', 'henry', 'heraldo', 'herbert', 'hercules', 'heriberto', 'hermes', 'hermogenes', 'hernani', 'hilario',
  'hilton', 'hipolito', 'homer', 'horacio', 'hugo', 'humberto', 'ian', 'ibere', 'igor', 'inacio',
  'irani', 'isaac', 'isaias', 'ismael', 'israel', 'italo', 'itamar', 'iuce', 'ivan', 'ivanildo',
  'ivo', 'jackson', 'jacob', 'jaconias', 'jacques', 'jader', 'jadson', 'jaime', 'jair', 'jairo',
  'james', 'jamerson', 'jamil', 'janio', 'jansen', 'jardel', 'jason', 'jaques', 'jean', 'jefferson',
  'jenilson', 'jeremias', 'jeremy', 'jeronimo', 'jesse', 'jhonatan', 'jhonathan', 'jimmy', 'joao',
  'joaquim', 'joel', 'joelson', 'johan', 'john', 'johnny', 'johnson', 'jonas', 'jonata', 'jonatas',
  'jonathan', 'jonathas', 'jorge', 'jose', 'joselito', 'josemar', 'josias', 'josue', 'juan',   'juliano',
  'julio', 'junior', 'jurandir', 'justiniano', 'kaua', 'kauan', 'kayke', 'kayky',
  'kelvin', 'kennedy', 'kevin', 'kleber', 'kleiton', 'kronos', 'lauro', 'leandro', 'leo', 'leonardo',
  'leonel', 'levi', 'levy', 'liam', 'lindomar', 'lino', 'liper', 'lorenzo', 'lorenço', 'lorival',
  'louiz', 'lourenco', 'lucas', 'luciano', 'lucio', 'luis', 'luiz', 'luke', 'maciel', 'magno',
  'maicon', 'manoel', 'manuel', 'marcelo', 'marcio', 'marco', 'marcos', 'marcus', 'mariano', 'mario',
  'marlon', 'martim', 'martin', 'mateus', 'matheus', 'mathias', 'matias', 'mauricio', 'mauro', 'max',
  'maximiano', 'maximiliano', 'maximo', 'maycon', 'melquisedeque', 'messias', 'michael', 'michel', 'miguel', 'milton',
  'moacir', 'moises', 'murilo', 'natan', 'nathan', 'nelson', 'neri', 'nestor', 'newton', 'ney',
  'nicholas', 'nicolas', 'nilo', 'nilson', 'nilton', 'nivaldo', 'noah', 'norberto', 'norman', 'octavio',
  'odair', 'odilson', 'odilon', 'olavo', 'oliver', 'olivio', 'omar', 'orazio', 'orlando', 'oscar',
  'osmar', 'osorio', 'osvaldo', 'otalicio', 'otavio', 'otho', 'otho', 'otto', 'pablo', 'paulo',
  'pedro', 'peterson', 'philip', 'phillipe', 'pierre', 'plinio', 'quiterio', 'rafael', 'raiam', 'raian',
  'raimon', 'ramiro', 'ramon', 'raul', 'rayan', 'rayanne', 'raymundo', 'reginaldo', 'reinaldo', 'remerson',
  'renan', 'renato', 'rene', 'ricardo', 'richard', 'rico', 'rinaldo', 'roberto', 'robson', 'rochedo',
  'rodnei', 'rodney', 'rodolfo', 'rodrigo', 'roger', 'rogerio', 'romario', 'romeu', 'romualdo', 'romulo',
  'ronaldo', 'ronan', 'roni', 'ronildo', 'roque', 'rosivaldo', 'rubem', 'rubens', 'rui', 'ruy',
  'ryan', 'samuel', 'sandro', 'saulo', 'savio', 'sebastiao', 'serafim', 'sergio', 'severino', 'sidnei',
  'sidney', 'silas', 'silvano', 'silvio', 'simeao', 'simao', 'stefan', 'stephano', 'steven', 'tadeu',
  'tales', 'talles', 'tarso', 'tarsis', 'teodoro', 'teogenes', 'theo', 'thiago', 'thomas', 'thomaz',
  'tiago', 'tibercio', 'timoteo', 'tito', 'tobias', 'tom', 'tomas', 'tomaz', 'tony', 'ulisses',
  'umberto', 'uriel', 'vagner', 'valdemar', 'valdemir', 'valdir', 'valter', 'vanderlei', 'vando', 'vicente',
  'victor', 'vinicius', 'vitor', 'vitorio', 'wagner', 'wallace', 'walter', 'wanderson', 'washington', 'webster',
  'wellington', 'welton', 'wendell', 'wesley', 'westley', 'weverton', 'wilian', 'william', 'williamson', 'willian',
  'wilson', 'wladimir', 'xavier', 'yago', 'yan', 'yago', 'yuri', 'yvandro', 'zacarias', 'zeca',
  'zenildo', 'zeze',
] as const;

const FEMININOS = [
  'abianca', 'adriana', 'adriane', 'agatha', 'agnes', 'aila', 'aina', 'aira', 'alaide', 'alana',
  'alanis', 'alberta', 'alcione', 'alessandra', 'alexandra', 'alice', 'alicia', 'aline', 'allana', 'alma',
  'alzira', 'amanda', 'amelia', 'ana', 'anabella', 'analice', 'analu', 'andreia', 'andresa', 'andressa',
  'angela', 'angelica', 'angelina', 'anita', 'anna', 'anne', 'antonella', 'antonia', 'aparecida', 'ariadne',
  'ariane', 'ariene', 'arlene', 'astrid', 'aurora', 'barbara', 'beatriz', 'bela', 'belinda', 'benedita',
  'bernadete', 'bernice', 'berta', 'betania', 'beth', 'bianca', 'brenda', 'bruna', 'brunna', 'camila',
  'camilla', 'carmem', 'carmen', 'carolina', 'caroline', 'caroliny', 'cassia', 'cassandra', 'catarina', 'catherine',
  'cecilia', 'celia', 'celina', 'celma', 'ceres', 'charlotte', 'chiara', 'cida', 'cindy', 'clara',
  'clarice', 'clarissa', 'claudia', 'cleia', 'cleide', 'clelia', 'cleusa', 'cloe', 'conceicao', 'constanca',
  'cristiana', 'cristiane', 'cristina', 'daiane', 'daisy', 'dalila', 'dalva', 'damaris', 'daniela', 'daniele',
  'daniella', 'danielle', 'dayana', 'dayane', 'debora', 'denise', 'diana', 'diane', 'dilma', 'dirce',
  'dolores', 'domenica', 'doris', 'dulce', 'edileusa', 'edilene', 'edina', 'edith', 'edna', 'eduarda',
  'elaine', 'elana', 'eliane', 'elis', 'elisa', 'elisabete', 'elisabeth', 'elise', 'eliza', 'elizabeth',
  'ellen', 'eloa', 'eloah', 'elsa', 'elvira', 'emanuela', 'emilia', 'emily', 'emilly', 'enilda',
  'erika', 'erika', 'esmeralda', 'ester', 'esther', 'eugenia', 'eunice', 'eva', 'evangelina', 'evelin',
  'eveline', 'evelyn', 'fabiana', 'fabiane', 'fabiola', 'fatima', 'fernanda', 'filomena', 'flavia', 'flor',
  'flora', 'florinda', 'franciele', 'francine', 'francisca', 'gabriela', 'gabriele', 'gabrielle', 'geise', 'geisa',
  'geni', 'georgia', 'geraldina', 'gertrudes', 'gilda', 'gina', 'giorgia', 'giovana', 'giovanna', 'gisela',
  'gisele', 'giselle', 'gislaine', 'gislene', 'glaucia', 'gloria', 'gorete', 'graciela', 'graziella', 'graziela',
  'guilhermina',   'hebe', 'helena', 'heloisa', 'heloiza', 'hilde', 'hilda', 'hortencia', 'iare', 'iara',
  'ida', 'ilana', 'ilda', 'ilza', 'inara', 'ines', 'ingrid', 'iolanda', 'irene',
  'iris', 'isabel', 'isabela', 'isabella', 'isabelle', 'isadora', 'isis', 'ivani', 'ivete', 'ivone',
  'izabel', 'izabela', 'jacira', 'jacqueline', 'jade', 'jaqueline', 'jana', 'janaína', 'janaina', 'jane',
  'janete', 'janice', 'jasmim', 'jasmin', 'jeanine', 'jennifer', 'jenny', 'jessica', 'joana', 'joanna',
  'joice', 'joyce', 'josefa', 'josiane', 'josiane', 'joyce', 'ju', 'juanita', 'julia', 'juliana',
  'julianne', 'julie', 'julieta', 'jurema', 'jussara', 'kailane', 'kamilly', 'karen', 'karina', 'karine',
  'karla', 'kassia', 'katarina', 'kate', 'katherine', 'katia', 'katiane', 'kelly', 'kelry', 'keila',
  'keyla', 'kimberly', 'kristina',   'laiane', 'lais', 'laila', 'lara', 'larissa', 'laura',
  'lavinia', 'lea', 'leandra', 'leila', 'lena', 'lenita', 'leonor', 'leticia', 'lia', 'liana',
  'lidia', 'lidiane', 'ligia', 'lilian', 'liliane', 'lilia', 'lillian', 'lily', 'lindalva', 'lisa',
  'livia', 'liz', 'lorena', 'lorraine', 'louise', 'lua', 'luana', 'lucelia', 'lucia', 'luciana',
  'luciane', 'luciene', 'lucilia', 'lucimara', 'ludmila', 'luisa', 'luiza', 'luzia', 'luziane',
  'mabel', 'madalena', 'magali', 'magda', 'maia', 'maira', 'maisa', 'manuela', 'mara', 'marcela',
  'marcia', 'margarida', 'maria', 'mariah', 'mariana', 'mariane', 'mariangela', 'marice', 'marie', 'marieta',
  'marilda', 'marilene', 'marilia', 'marina', 'marineide', 'marinês', 'marines', 'marisa', 'marise', 'marisol',
  'marta', 'martha', 'martina', 'mary', 'matea', 'matilde', 'maura', 'maura', 'mayara', 'mayra',
  'mel', 'melanie', 'melissa', 'mercedes', 'michele', 'michelle', 'milena', 'mirela', 'mirella', 'miriam',
  'mirian', 'monica', 'monique', 'morgana', 'nadia', 'nadine', 'nair', 'nancy', 'nara', 'natalia',
  'nathalia', 'nathaly', 'nayara', 'neide', 'nelma', 'neli', 'nicole', 'nilce', 'nilza', 'noadia',
  'noelia', 'noemi', 'norma', 'nubia', 'olga', 'olivia', 'otavia', 'pamela', 'paola', 'patricia',
  'paulina', 'pauline', 'penelope', 'petra', 'pietra', 'poliana', 'priscila', 'queila', 'quiteria', 'rachel',
  'raquel', 'rayane', 'rayssa', 'rebeca', 'rebecca', 'regina', 'renata', 'rita', 'robertina', 'rosa',
  'rosana', 'rosangela', 'rosaria', 'rose', 'roseane', 'roseli', 'rosemary', 'rosilene', 'rosimeire', 'roxane',
  'rubia', 'ruth', 'sabrina', 'salete', 'samanta', 'samara', 'sandra', 'sara', 'sarah', 'sasha',
  'selma', 'sharon', 'sheila', 'shirley', 'silvana', 'silvia', 'simone', 'sofia', 'solange', 'sonia',
  'sophia', 'sophie', 'stella', 'stephanie', 'stefany', 'suelen', 'sueli', 'suzana', 'suzanne', 'suzete',
  'taiane', 'tais', 'taisa', 'taisane', 'talita', 'tamara', 'tania', 'tatiana', 'tatiane', 'telma',
  'teresa', 'tereza', 'thais', 'thai', 'thaisa', 'thalita', 'thalia', 'thereza', 'tina', 'ualeria',
  'valentina', 'valeria', 'valeska', 'vanda', 'vanessa', 'vera', 'veronica', 'vilma', 'virginia', 'vitoria',
  'vivian', 'viviane', 'waleria', 'wandinha', 'wendy', 'wilma', 'yasmin', 'yasmim', 'yolanda', 'yara',
  'yvone', 'zelia', 'zenaide', 'zilda', 'zuleica', 'zuleide', 'zuleika', 'zulmira',
] as const;

/** Nomes ambíguos / unissex — não classificar automaticamente. */
const AMBIGUOS = new Set([
  'alex', 'andrea', 'ariel', 'dani', 'dom', 'gui', 'isa', 'jordan', 'kai', 'leslie',
  'nicolle', 'noa', 'noah', 'robin', 'sam', 'tony',
]);

function buildMap(): Record<string, GeneroNome> {
  const map: Record<string, GeneroNome> = {};
  for (const n of MASCULINOS) {
    if (!AMBIGUOS.has(n)) map[n] = 'M';
  }
  for (const n of FEMININOS) {
    if (!AMBIGUOS.has(n)) map[n] = 'F';
  }
  // Conflitos conhecidos: preferir o gênero mais comum no Brasil para cadastro TAF.
  // "Alex" e similares ficam em AMBIGUOS.
  // Jessica aparece só como F (removido de M se houver).
  map.jessica = 'F';
  map.jussara = 'F';
  return map;
}

export const DICIONARIO_NOMES_GENERO: Readonly<Record<string, GeneroNome>> = buildMap();
