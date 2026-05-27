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

export namespace settings {
	
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
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.endpoints = this.convertValues(source["endpoints"], LLMEndpoint);
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

