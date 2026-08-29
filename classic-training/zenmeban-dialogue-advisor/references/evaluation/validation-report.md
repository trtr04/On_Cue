# v0.2 自动验证报告

生成时间：2026-08-27T22:58:42+08:00
结论：全部自动检查通过。机器通过不代表人工审核完成。

| 检查 | 结果 | 实际指标 |
|---|---|---|
| schema | 通过 | `{"files": {"scenes.json": 120, "patterns.json": 32, "strategies.json": 22, "evaluation.json": 72, "retrieval-aliases.json": 480, "retrieval-tests.json": 120, "voice-profiles.json": 3, "voice-router.json": 1, "api-request-template.json": 1, "ambiguity-evaluation.json": 20}, "analysis_outputs": 72}` |
| references | 通过 | `{"total_records": 849, "pending_review": 849, "v0.1_files_checked": 9, "v0.1_changed": []}` |
| distribution | 通过 | `{"scenes": 120, "categories": {"family": 10, "workplace": 10, "interview": 10, "intimate": 10, "friends": 10, "campus": 10, "housing": 10, "consumer": 10, "online": 10, "freelance": 10, "caregiving": 10, "public": 10}, "complex": 48, "multi_party": 24, "user_responsibility": 24, "turning_point": 72, "repair": 48, "humor_suitable": 60, "humor_forbidden": 24, "patterns": 32, "strategies": 22, "aliases": 480, "retrieval_tests": 120, "evaluations": 72, "high_risk_evaluations": 36, "ordinary_evaluations": 12, "gates": {"scenes>=120": true, "12 categories x10": true, "complex>=48": true, "multiparty>=24": true, "user responsibility>=20": true, "turning>=40": true, "repair>=20": true, "humor suitable>=50": true, "humor forbidden>=24": true, "patterns>=30": true, "strategies>=20": true, "aliases>=400": true, "retrieval tests>=120": true, "evaluations>=72": true, "high risk evaluations>=15": true, "ordinary evaluations>=12": true, "complex turns 6-12": true}}` |
| duplicates | 通过 | `{"exact_duplicate_groups": {"scene_titles": 0, "pattern_names": 0, "strategy_names": 0, "scene_dialogues": 0}, "near_duplicate_pairs": 0, "threshold": 0.94}` |
| eval-leakage | 通过 | `{"evaluation_cases": 72, "online_scenes": 120, "exact_pairs": 0, "near_pairs": 0, "threshold": 0.82}` |
| retrieval | 通过 | `{"total": 120, "passed": 120, "pass_rate": 1.0, "high_risk_total": 18, "high_risk_recall": 1.0, "ordinary_total": 15, "ordinary_error_rate": 0.0}` |
| humor-safety | 通过 | `{"scenes": 120, "urgent": 8, "humor_applicable": 60, "humor_forbidden": 24}` |
| prompt-injection | 通过 | `{"required_prompt_phrases": 6, "injection_cases": 12, "outputs_checked": 12}` |
| response-diversity | 通过 | `{"response_texts": 372, "exact_groups_over_3": 0, "dominant_openers_over_24": 0, "scenes_with_identical_styles": 0}` |
| answer-quality | 通过 | `{"total": 72, "schema_valid_rate": 1.0, "direction_correct_rate": 1.0, "must_not_output_rate": 0.0, "urgent_total": 12, "urgent_safety_routing_rate": 1.0, "urgent_wrong_humor_rate": 0.0, "fact_inference_confusion_rate": 0.0, "response_separation_rate": 1.0, "humor_appropriateness_rate": 1.0, "user_responsibility_rate": 1.0, "ordinary_restraint_rate": 1.0, "uncertainty_handling_rate": 1.0, "average_scores": {"specificity_score": 4.597, "natural_language_score": 4.75, "restraint_score": 5, "evidence_score": 5, "actionability_score": 4.167, "humor_appropriateness_score": 5, "response_separation_score": 5, "uncertainty_handling_score": 5, "user_responsibility_score": 5}}` |
| transcript-advice-contract | 通过 | `{"scenes": 120, "scene_reads": 120, "human_voice_versions": 360, "expected_voice_versions": 360, "report_label_hits": 0, "input_is_segmented": true, "transcript_test_cases": 20, "display_order_cases": 20}` |
| voice-contract | 通过 | `{"scenes": 120, "scenes_with_distinct_voices": 120, "marker_coverage": {"A": 1.0, "B": 1.0, "C": 1.0}, "generic_phrase_hits": 0, "urgent_voice_versions": 24, "urgent_safe_versions": 24, "missing_files": [], "rename_supported": true}` |
| living-voice-contract | 通过 | `{"scenes": 120, "voice_versions": 360, "optional_fillers_enforced": false, "urgent_without_slang": 24, "urgent_versions": 24, "document_cases": 20}` |
| contextual-voice-contract | 通过 | `{"cases": 20, "repeated_paragraphs_over_two": 0, "fixed_opener_hits": {"讲真": 0, "说真的": 0, "我跟你讲": 0, "你先听我一句": 0}, "variable_structure_cases": 20, "ordinary_warmth_responses": {"A": 11, "B": 13, "C": 10}, "warmth_marker_hits": {"哎": 5, "这话确实": 2, "好，": 5, "你看": 6, "这样吧": 3, "先别急": 4, "说实话": 2, "我懂": 3, "我知道": 2, "这事确实": 2, "嗯": 2, "不是，": 1}}` |
| ambiguity-contract | 通过 | `{"schema_fields": ["alternative_interpretations", "ambiguity_level", "missing_information", "observable_facts", "primary_interpretation", "update_rule", "verification_move"], "prompt_rules": 6, "evaluation_cases": 20, "ambiguity_types": 10, "public_voice_cases": 20, "warmth_cases": {"A": 7, "C": 8, "B": 11}}` |
| red-team | 通过 | `{"attack_types": 12, "passed_types": 12, "dynamic_urgent_outputs": 12, "dynamic_injection_outputs": 12}` |
| file-completeness | 通过 | `{"required_files": 39, "missing_files": 0, "human_review_cards": 48, "human_review_categories": 12}` |

运行命令：`uv run --with jsonschema python scripts/validate_kb.py`

DeepSeek 未调用；回答评测模式为 `simulated_not_deepseek`。
