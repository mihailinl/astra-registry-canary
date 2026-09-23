use astra_plugin_sdk::prelude::*;

#[derive(Default)]
struct ReleaseCanaryC3f3424;

#[astra::plugin]
impl ReleaseCanaryC3f3424 {
    /// Say hello. Describe when to use the tool, not how it works.
    #[tool]
    async fn hello(&self) -> Result<String, ToolError> {
        Ok("Hello from the plugin!".into())
    }
}

astra::main!(ReleaseCanaryC3f3424::default());

#[cfg(test)]
mod tests {
    use super::*;
    use astra_plugin_sdk::testing::Harness;

    /// `cargo test`. The harness runs the hooks in process against a recording
    /// host: no daemon, no socket, no Astra installed.
    ///
    /// `h.host().fired_triggers()` / `.logs()` / `.variables()` say what the
    /// plugin told Astra; `h.host().deny("fire_trigger")` stages the refusal a
    /// user's `[permissions]` would produce. For the wire — registration, the
    /// session token, streaming audio — there is
    /// `astra_plugin_sdk::testing::WireHarness`.
    #[tokio::test]
    async fn it_starts_and_answers() {
        let h = Harness::new(ReleaseCanaryC3f3424::default())
            .with_config(json!({}))
            .start()
            .await
            .expect("the plugin started");

        let answer = h.call_tool("hello", json!({})).await.expect("the tool answered");
        assert_eq!(answer, "Hello from the plugin!");

        assert!(h.health().await.0);
    }
}
