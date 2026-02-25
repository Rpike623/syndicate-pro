/**
 * deeltrack - Backend Connector
 * Abstracted layer to handle Cloud DB (Supabase/Firebase) vs LocalDB
 */

const Backend = {
    // Configuration - Robert, you'll put your Supabase/Firebase keys here
    config: {
        provider: 'local', // 'supabase', 'firebase', or 'local'
        url: '',
        key: ''
    },

    client: null,

    /**
     * Initialize the cloud connection
     */
    async init(provider = 'local', url = '', key = '') {
        this.config.provider = provider;
        this.config.url = url;
        this.config.key = key;

        if (provider === 'supabase') {
            // Integration for Supabase
            // Import script dynamically if not present
            if (typeof supabase === 'undefined') {
                await this.loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
            }
            this.client = supabase.createClient(url, key);
        }
        
        console.log(`deeltrack Backend: Initialized as ${provider}`);
        return true;
    },

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * Sync Local IndexedDB to Cloud
     */
    async syncToCloud() {
        if (this.config.provider === 'local') return;

        console.log('Syncing LocalDB to Cloud...');
        const allData = await db.exportAllData();
        
        if (this.config.provider === 'supabase') {
            // Bulk upsert logic for Supabase tables
            // This is where the schema mapping happens
            for (const table of ['deals', 'investors', 'distributions', 'documents']) {
                if (allData[table] && allData[table].length > 0) {
                    const { error } = await this.client
                        .from(table)
                        .upsert(allData[table]);
                    if (error) console.error(`Sync error (${table}):`, error);
                }
            }
        }
    },

    /**
     * Pull from Cloud to Local
     */
    async fetchFromCloud() {
        if (this.config.provider === 'local') return;

        if (this.config.provider === 'supabase') {
            const data = {};
            for (const table of ['deals', 'investors', 'distributions', 'documents']) {
                const { data: tableData, error } = await this.client.from(table).select('*');
                if (!error) data[table] = tableData;
            }
            await db.importData(data);
        }
    },

    /**
     * Auth helpers
     */
    async login(email, password) {
        if (this.config.provider === 'supabase') {
            return await this.client.auth.signInWithPassword({ email, password });
        }
        return { user: { email: 'demo@deeltrack.com' }, error: null };
    },

    async signup(email, password) {
        if (this.config.provider === 'supabase') {
            return await this.client.auth.signUp({ email, password });
        }
        return { user: { email }, error: null };
    }
};

// Auto-initialize if config exists in storage
const savedConfig = localStorage.getItem('backendConfig');
if (savedConfig) {
    const cfg = JSON.parse(savedConfig);
    Backend.init(cfg.provider, cfg.url, cfg.key);
}
