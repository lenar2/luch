# LUCH 54 browser tool definitions versus Chrome Companion 0.5.0

Source: authenticated tool inventory: 41 browser_* + 13 server_browser_* methods. **They are different execution providers**; not 54 identical extension commands.

### Local browser 41 tool definitions (mapping)
| LUCH public tool | Extension R3 binding | Limitation |
|---|---|---|
| browser_list | platform route | Browser discovery is platform-level |
| browser_tabs | supported via broker | Lists user-approved tabs only |
| browser_read_text | implemented | Approved tab only |
| browser_health | platform route | Broker health is separate |
| browser_start | platform route | Requires actual browser host |
| browser_new_tab | implemented | New tab needs separate approval |
| browser_new_window | implemented | New window needs separate approval |
| browser_window_info | implemented | Approved tab's window only |
| browser_window_set | implemented | Approved tab's window only |
| browser_close_tab | restricted | Extension-created tabs only |
| browser_navigate | implemented | Origin changes revoke |
| browser_click | implemented | DOM click on the approved tab, including submit and labeled actions |
| browser_mouse_move | partial | DOM hover, not native pointer |
| browser_click_at | implemented | DOM hit testing |
| browser_drag_at | not implemented | Trusted/native drag outside this channel |
| browser_hit_test | implemented | DOM point inspection |
| browser_scroll | implemented | DOM scrolling |
| browser_insert_text | implemented | Safe ordinary fields only |
| browser_accessibility_snapshot | partial | Bounded role/element summary, not full AX tree |
| browser_click_accessible | partial | Selector-based; no general name/role resolver |
| browser_type | implemented | DOM field value/change, not trusted OS typing |
| browser_wait_url | not implemented | Requires dedicated wait tracking |
| browser_wait_load | not implemented | Requires dedicated wait tracking |
| browser_wait_network_idle | not implemented | Would require additional instrumentation |
| browser_network_summary | not implemented | No debugger/network interception permission |
| browser_console_watch | not implemented | No debugger permission |
| browser_screenshot | implemented | Active approved tab, size-bounded JPEG |
| browser_upload | not implemented | File picker/OS boundary |
| browser_download | not implemented | Would add downloads permission |
| browser_status | platform + popup | Approved session and connection state |
| browser_open_tab | implemented via new_tab | New tab requires approval |
| browser_activate_tab | implemented | Approved tab only |
| browser_reload | implemented | Approved tab only |
| browser_back | implemented | Approved tab only |
| browser_forward | implemented | Approved tab only |
| browser_select | implemented | Select element |
| browser_wait | not implemented | Needs bounded wait operation |
| browser_recover | platform route | Requires actual browser transport |
| browser_key_chord | not implemented | Native/trusted keyboard outside this channel |
| browser_press | not implemented | Native/trusted key outside this channel |
| browser_route | platform route | Never silently route to wrong profile |

### Separate server browser tools (13)
server_browser_health, server_browser_acquire, server_browser_status, server_browser_evidence, server_browser_navigate, server_browser_read_text, server_browser_screenshot, server_browser_click, server_browser_type, server_browser_wait, server_browser_upload, server_browser_download, server_browser_release.

All 13 remain on the isolated server-browser provider. They must **not** be marketed as functions installed inside Chrome. The unified AI interface may expose them alongside local-browser tools when the caller has the relevant permission.

### Added extension-specific operations
inspect_page, get_links, get_headings, get_forms, get_tables, get_selection, query_elements, find_text, get_element, scroll_position, hover, focus, double_click, scroll_into_view, scroll_to, check_element, new_window, new_tab, screenshot, tab_info, window_info, etc. These make the extension useful, but are not proof of 54-to-54 compatibility or full runtime E2E.
