const API_URL =
  "https://europe-west1-norwegian-language-learning.cloudfunctions.net";
const AUTHORIZATION_URL =
  "https://discordapp.com/api/oauth2/authorize?client_id=446812874615029763&redirect_uri=https%3A%2F%2Fnorwegianlanguagelearning.no%2Fpage%2Froles%2F&response_type=code&scope=identify&prompt=none";

var app = new Vue({
  template: `
    <div v-if="state == 'loading'">Loading roles ...</div>
    <div v-else-if="state == 'redirecting'">Redirecting to authorization ...</div>
    <div v-else-if="state == 'error'">Something went wrong.</div>
    <div v-else-if="state == 'loaded'">
      <form @submit.prevent="submit">
        <fieldset class="form-group" v-for="(roles, category) in rolesByCategory" :key="category">
          <legend>{{ category }}</legend>
          <div class="checkbox" v-for="role in roles" style="line-height: normal;">
            <label>
              <input :key="role.id" type="checkbox" :value="role.id"
                v-model="selectedRoles">
              {{ role.name }}<span v-if="role.description">: {{ role.description }}</span>
            </label>
          </div>
        </fieldset>
        <button type="submit" class="btn btn-default" :disabled="submitting">
          <span v-if="submitting">Changing your roles ...</span>
          <span v-else>Change your roles</span>
        </button>
      </form>
    </div>`,
  el: "#app",
  data: {
    state: "",
    accessToken: "",
    roles: [],
    selectedRoles: [],
    submitting: false,
  },
  async created() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has("code")) {
      this.state = "redirecting";
      window.location.href = AUTHORIZATION_URL;
      return;
    }
    const code = urlParams.get("code");
    urlParams.delete("code");
    const urlParamsString = urlParams.toString();
    history.pushState(
      {},
      "",
      `${location.origin}${location.pathname}${
        urlParamsString ? "?" : ""
      } ${urlParamsString}`
    );
    this.state = "loading";
    try {
      await Promise.all([
        this.fetchAccessToken(code).then(this.fetchUserRoles),
        this.fetchRoles(),
      ]);
    } catch (err) {
      if (this.state != "redirecting") {
        this.state = "error";
      }
      console.log(err);
      return;
    }
    this.state = "loaded";
  },
  methods: {
    async fetchAccessToken(code) {
      const response = await fetch(`${API_URL}/access_token/?code=${code}`);
      const body = JSON.parse(await response.text());
      if (!response.ok) {
        if (response.status == 400 && body.detail == "Invalid code") {
          this.state = "redirecting";
          window.location.href = AUTHORIZATION_URL;
        }
        throw response;
      }
      this.accessToken = body.accessToken;
    },
    async fetchUserRoles() {
      const response = await fetch(`${API_URL}/user_roles/`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (!response.ok) {
        throw response;
      }
      const body = JSON.parse(await response.text());
      this.selectedRoles = body.roles;
    },
    async fetchRoles() {
      const response = await fetch(`${API_URL}/roles/`);
      if (!response.ok) {
        throw response;
      }
      const body = JSON.parse(await response.text());
      this.roles = body.roles;
    },
    async submit() {
      this.submitting = true;
      await fetch(`${API_URL}/user_roles/`, {
        method: "put",
        body: JSON.stringify(
          this.selectedRoles.map((roleId) => ({ id: roleId }))
        ),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
      this.submitting = false;
    },
  },
  computed: {
    rolesByCategory() {
      const rolesByCategory = {};
      for (const role of this.roles) {
        const category = role.category;
        if (!rolesByCategory[category]) {
          rolesByCategory[category] = [];
        }
        rolesByCategory[category].push(role);
      }
      return rolesByCategory;
    },
  },
});
