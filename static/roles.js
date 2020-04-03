const API_URL =
  "https://europe-west1-norwegian-language-learning.cloudfunctions.net";
const AUTHORIZATION_URL =
  "https://discordapp.com/api/oauth2/authorize?client_id=446812874615029763&redirect_uri=https%3A%2F%2Fnorwegianlanguagelearning.no%2Fpage%2Froles%2F&response_type=code&scope=identify&prompt=none";

var app = new Vue({
  template: `
    <div v-if="state == 'confirmation'">
      <p>
        To change your roles, you first need to authorize access on the Discord website. 
        This will only let us see who you are.
      </p>
      <a href="${AUTHORIZATION_URL}">Authorize access</a>
    </div>
    <div v-else-if="state == 'invite'">
      <p>It looks like you're not a member of our Discord community yet. <a href="https://discord.gg/mBsKjx7">Join us!</a></p>
    </div>
    <div v-else-if="state == 'need-introduction'">
      <p>You haven't been approved yet. Have you written an introduction in our <a href="https://www.discordapp.com/channels/143458761665675264/483672165137383454">welcome channel?</a></p>
    </div>
    <div v-else-if="state == 'loading'">
      <p>Loading roles ...</p>
    </div>
    <div v-else-if="state == 'redirecting'">
      <p>Redirecting to authorization ...</p>
    </div>
    <div v-else-if="state == 'error'">
      <p>Something went wrong. You could try refreshing.</p>
    </div>
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
    </div>
  `,
  el: "#app",
  data: {
    state: localStorage.getItem("authorized") !== null ? "" : "confirmation",
    accessToken: "",
    roles: [],
    selectedRoles: [],
    submitting: false,
  },
  async created() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has("code")) {
      if (this.state !== "confirmation") {
        this.state = "redirecting";
        window.location.href = AUTHORIZATION_URL;
      }
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
      await this.fetchUserRoles(code);
    } catch (err) {
      if (err.status == 400) {
        const body = JSON.parse(await err.text());
        if (body.detail == "Invalid code") {
          window.location.search = "";
          return;
        }
      } else if (err.status == 404) {
        this.state = "invite";
        return;
      } else if (err.status == 403) {
        this.state = "need-introduction";
        return;
      }
      this.state = "error";
      console.log(err);
      return;
    }
    this.state = "loaded";
    localStorage.setItem("authorized", "");
  },
  methods: {
    async fetchUserRoles(code) {
      const response = await fetch(`${API_URL}/user_roles/?code=${code}`);
      if (!response.ok) {
        throw response;
      }
      const body = JSON.parse(await response.text());
      this.selectedRoles = body.userRoles;
      this.roles = body.roles;
      this.accessToken = body.accessToken;
    },
    async submit() {
      this.submitting = true;
      await fetch(`${API_URL}/user_roles/`, {
        method: "put",
        body: JSON.stringify(this.selectedRoles),
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
