export namespace app {
	
	export class CrawlSendResult {
	    characters: compose.Character[];
	    lorebook: lorebook.Entry[];
	    activeCharId: number;
	
	    static createFrom(source: any = {}) {
	        return new CrawlSendResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.characters = this.convertValues(source["characters"], compose.Character);
	        this.lorebook = this.convertValues(source["lorebook"], lorebook.Entry);
	        this.activeCharId = source["activeCharId"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CrawlState {
	    url: string;
	    followLinks: number;
	    include: Record<string, boolean>;
	    selectors: string;
	    roles: Record<string, string>;
	    sent: Record<string, string>;
	    set?: crawler.CrawlSet;
	
	    static createFrom(source: any = {}) {
	        return new CrawlState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.followLinks = source["followLinks"];
	        this.include = source["include"];
	        this.selectors = source["selectors"];
	        this.roles = source["roles"];
	        this.sent = source["sent"];
	        this.set = this.convertValues(source["set"], crawler.CrawlSet);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DroppedImage {
	    name: string;
	    dataUrl: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new DroppedImage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.dataUrl = source["dataUrl"];
	        this.size = source["size"];
	    }
	}
	export class ExportResult {
	    exported: number;
	    failed: number;
	    paths: string[];
	
	    static createFrom(source: any = {}) {
	        return new ExportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.exported = source["exported"];
	        this.failed = source["failed"];
	        this.paths = source["paths"];
	    }
	}
	export class ImportCardResult {
	    character: compose.Character;
	    importedEntries: number;
	
	    static createFrom(source: any = {}) {
	        return new ImportCardResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.character = this.convertValues(source["character"], compose.Character);
	        this.importedEntries = source["importedEntries"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SendCrawlOutcome {
	    status: string;
	    kind: string;
	    name: string;
	    result: CrawlSendResult;
	
	    static createFrom(source: any = {}) {
	        return new SendCrawlOutcome(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.result = this.convertValues(source["result"], CrawlSendResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace cardexport {
	
	export class Options {
	    EmbedLorebook: boolean;
	    ScopePerChar: boolean;
	    IncludeGreetings: boolean;
	    StripMetadata: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Options(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.EmbedLorebook = source["EmbedLorebook"];
	        this.ScopePerChar = source["ScopePerChar"];
	        this.IncludeGreetings = source["IncludeGreetings"];
	        this.StripMetadata = source["StripMetadata"];
	    }
	}

}

export namespace comfy {
	
	export class WorkflowParams {
	    prompt: string;
	    negativePrompt: string;
	    seed: number;
	    steps: number;
	    cfg: number;
	    sampler: string;
	    scheduler: string;
	    width: number;
	    height: number;
	    checkpoint: string;
	    denoise: number;
	
	    static createFrom(source: any = {}) {
	        return new WorkflowParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.prompt = source["prompt"];
	        this.negativePrompt = source["negativePrompt"];
	        this.seed = source["seed"];
	        this.steps = source["steps"];
	        this.cfg = source["cfg"];
	        this.sampler = source["sampler"];
	        this.scheduler = source["scheduler"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.checkpoint = source["checkpoint"];
	        this.denoise = source["denoise"];
	    }
	}
	export class ComfyWorkflow {
	    id: string;
	    name: string;
	    jsonData: string;
	    template: string;
	    params: WorkflowParams;
	
	    static createFrom(source: any = {}) {
	        return new ComfyWorkflow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.jsonData = source["jsonData"];
	        this.template = source["template"];
	        this.params = this.convertValues(source["params"], WorkflowParams);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CompletedImage {
	    filename: string;
	    subfolder: string;
	    type: string;
	    data: number[];
	
	    static createFrom(source: any = {}) {
	        return new CompletedImage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.subfolder = source["subfolder"];
	        this.type = source["type"];
	        this.data = source["data"];
	    }
	}
	export class GenerationParams {
	    workflowTemplate: string;
	    seed: number;
	    steps: number;
	    cfg: number;
	    sampler: string;
	    scheduler: string;
	    denoise: number;
	    positivePrompt: string;
	    negativePrompt: string;
	    width: number;
	    height: number;
	    checkpoint: string;
	
	    static createFrom(source: any = {}) {
	        return new GenerationParams(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workflowTemplate = source["workflowTemplate"];
	        this.seed = source["seed"];
	        this.steps = source["steps"];
	        this.cfg = source["cfg"];
	        this.sampler = source["sampler"];
	        this.scheduler = source["scheduler"];
	        this.denoise = source["denoise"];
	        this.positivePrompt = source["positivePrompt"];
	        this.negativePrompt = source["negativePrompt"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.checkpoint = source["checkpoint"];
	    }
	}

}

export namespace compose {
	
	export class StatKV {
	    key: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new StatKV(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	    }
	}
	export class Character {
	    id: number;
	    name: string;
	    epithet: string;
	    tags: string[];
	    appearance: string;
	    personality: string;
	    backstory: string;
	    abilities: string;
	    relationships: string;
	    quotes: string[];
	    altGreetings: string[];
	    stats: StatKV[];
	    dirty: boolean;
	    portrait: number[];
	    sourceUrl?: string;
	
	    static createFrom(source: any = {}) {
	        return new Character(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.epithet = source["epithet"];
	        this.tags = source["tags"];
	        this.appearance = source["appearance"];
	        this.personality = source["personality"];
	        this.backstory = source["backstory"];
	        this.abilities = source["abilities"];
	        this.relationships = source["relationships"];
	        this.quotes = source["quotes"];
	        this.altGreetings = source["altGreetings"];
	        this.stats = this.convertValues(source["stats"], StatKV);
	        this.dirty = source["dirty"];
	        this.portrait = source["portrait"];
	        this.sourceUrl = source["sourceUrl"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace crawler {
	
	export class CrawlOptions {
	    followLinks: number;
	    include: Record<string, boolean>;
	    selectors?: string[];
	
	    static createFrom(source: any = {}) {
	        return new CrawlOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.followLinks = source["followLinks"];
	        this.include = source["include"];
	        this.selectors = source["selectors"];
	    }
	}
	export class InfoboxEntry {
	    key: string;
	    value: string;
	    section?: string;
	
	    static createFrom(source: any = {}) {
	        return new InfoboxEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.section = source["section"];
	    }
	}
	export class Section {
	    heading: string;
	    body: string;
	    level: number;
	
	    static createFrom(source: any = {}) {
	        return new Section(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.heading = source["heading"];
	        this.body = source["body"];
	        this.level = source["level"];
	    }
	}
	export class CrawlResult {
	    title: string;
	    url: string;
	    domain: string;
	    rawHtml: string;
	    sections: Section[];
	    infobox: InfoboxEntry[];
	    wordCount: number;
	    statusCode: number;
	    latencyMs: number;
	    depth: number;
	    parentUrl?: string;
	    isMediaWiki: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CrawlResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.url = source["url"];
	        this.domain = source["domain"];
	        this.rawHtml = source["rawHtml"];
	        this.sections = this.convertValues(source["sections"], Section);
	        this.infobox = this.convertValues(source["infobox"], InfoboxEntry);
	        this.wordCount = source["wordCount"];
	        this.statusCode = source["statusCode"];
	        this.latencyMs = source["latencyMs"];
	        this.depth = source["depth"];
	        this.parentUrl = source["parentUrl"];
	        this.isMediaWiki = source["isMediaWiki"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CrawlSet {
	    rootUrl: string;
	    results: CrawlResult[];
	
	    static createFrom(source: any = {}) {
	        return new CrawlSet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rootUrl = source["rootUrl"];
	        this.results = this.convertValues(source["results"], CrawlResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace library {
	
	export class Entry {
	    path: string;
	    name: string;
	    status: string;
	    updatedAt: string;
	    sourceShort: string;
	    tags: string[];
	    tokens: number;
	    hasThumbnail: boolean;
	    thumbRef: string;
	    missing: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Entry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.updatedAt = source["updatedAt"];
	        this.sourceShort = source["sourceShort"];
	        this.tags = source["tags"];
	        this.tokens = source["tokens"];
	        this.hasThumbnail = source["hasThumbnail"];
	        this.thumbRef = source["thumbRef"];
	        this.missing = source["missing"];
	    }
	}

}

export namespace llm {
	
	export class TestResult {
	    ok: boolean;
	    latency_ms: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new TestResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.latency_ms = source["latency_ms"];
	        this.error = source["error"];
	    }
	}

}

export namespace lorebook {
	
	export class Entry {
	    uid: number;
	    comment: string;
	    key: string[];
	    keysecondary: string[];
	    content: string;
	    constant: boolean;
	    selective: boolean;
	    selectiveLogic: number;
	    addMemo: boolean;
	    order: number;
	    position: number;
	    disable: boolean;
	    probability: number;
	    useProbability: boolean;
	    depth: number;
	    sticky: number;
	    vectorized: boolean;
	    ignoreBudget: boolean;
	    excludeRecursion: boolean;
	    preventRecursion: boolean;
	    characters: string[];
	    sourceUrl?: string;
	
	    static createFrom(source: any = {}) {
	        return new Entry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uid = source["uid"];
	        this.comment = source["comment"];
	        this.key = source["key"];
	        this.keysecondary = source["keysecondary"];
	        this.content = source["content"];
	        this.constant = source["constant"];
	        this.selective = source["selective"];
	        this.selectiveLogic = source["selectiveLogic"];
	        this.addMemo = source["addMemo"];
	        this.order = source["order"];
	        this.position = source["position"];
	        this.disable = source["disable"];
	        this.probability = source["probability"];
	        this.useProbability = source["useProbability"];
	        this.depth = source["depth"];
	        this.sticky = source["sticky"];
	        this.vectorized = source["vectorized"];
	        this.ignoreBudget = source["ignoreBudget"];
	        this.excludeRecursion = source["excludeRecursion"];
	        this.preventRecursion = source["preventRecursion"];
	        this.characters = source["characters"];
	        this.sourceUrl = source["sourceUrl"];
	    }
	}

}

export namespace project {
	
	export class ProjectManifest {
	    version: string;
	    name: string;
	    status?: string;
	    tags?: string[];
	    createdAt: string;
	    updatedAt: string;
	    activeCharId: number;
	    sourceUrl: string;
	    crawlTitle: string;
	    crawlFollowLinks?: number;
	    crawlInclude?: Record<string, boolean>;
	    crawlSelectors?: string;
	    crawlRoles?: Record<string, string>;
	    crawlSent?: Record<string, string>;
	    projectImage: number[];
	    fieldEndpoints?: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new ProjectManifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.tags = source["tags"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.activeCharId = source["activeCharId"];
	        this.sourceUrl = source["sourceUrl"];
	        this.crawlTitle = source["crawlTitle"];
	        this.crawlFollowLinks = source["crawlFollowLinks"];
	        this.crawlInclude = source["crawlInclude"];
	        this.crawlSelectors = source["crawlSelectors"];
	        this.crawlRoles = source["crawlRoles"];
	        this.crawlSent = source["crawlSent"];
	        this.projectImage = source["projectImage"];
	        this.fieldEndpoints = source["fieldEndpoints"];
	    }
	}

}

export namespace prompts {
	
	export class TemplateSet {
	    systemPrompt: string;
	    fieldPrompts: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new TemplateSet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.systemPrompt = source["systemPrompt"];
	        this.fieldPrompts = source["fieldPrompts"];
	    }
	}

}

export namespace settings {
	
	export class ComfyConfig {
	    url: string;
	    authToken?: string;
	    outputFolder: string;
	    defaultWorkflow: string;
	    workflows: comfy.ComfyWorkflow[];
	
	    static createFrom(source: any = {}) {
	        return new ComfyConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.authToken = source["authToken"];
	        this.outputFolder = source["outputFolder"];
	        this.defaultWorkflow = source["defaultWorkflow"];
	        this.workflows = this.convertValues(source["workflows"], comfy.ComfyWorkflow);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CrawlerConfig {
	    userAgent?: string;
	    rateLimitMs?: number;
	    maxPages?: number;
	
	    static createFrom(source: any = {}) {
	        return new CrawlerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.userAgent = source["userAgent"];
	        this.rateLimitMs = source["rateLimitMs"];
	        this.maxPages = source["maxPages"];
	    }
	}
	export class LLMEndpoint {
	    id: number;
	    name: string;
	    url: string;
	    model: string;
	    key?: string;
	    isDefault: boolean;
	    contextSize: number;
	    temperature: number;
	    systemPrompt: string;
	    ok: boolean;
	
	    static createFrom(source: any = {}) {
	        return new LLMEndpoint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.model = source["model"];
	        this.key = source["key"];
	        this.isDefault = source["isDefault"];
	        this.contextSize = source["contextSize"];
	        this.temperature = source["temperature"];
	        this.systemPrompt = source["systemPrompt"];
	        this.ok = source["ok"];
	    }
	}
	export class Settings {
	    endpoints: LLMEndpoint[];
	    comfy: ComfyConfig;
	    promptTemplates?: prompts.TemplateSet;
	    autoSaveMode?: string;
	    autoSaveInterval?: number;
	    fieldEndpoints?: Record<string, number>;
	    crawler?: CrawlerConfig;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.endpoints = this.convertValues(source["endpoints"], LLMEndpoint);
	        this.comfy = this.convertValues(source["comfy"], ComfyConfig);
	        this.promptTemplates = this.convertValues(source["promptTemplates"], prompts.TemplateSet);
	        this.autoSaveMode = source["autoSaveMode"];
	        this.autoSaveInterval = source["autoSaveInterval"];
	        this.fieldEndpoints = source["fieldEndpoints"];
	        this.crawler = this.convertValues(source["crawler"], CrawlerConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

