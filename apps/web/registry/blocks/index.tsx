import Dashboard01 from "@/registry/blocks/dashboard-01/page"
import Sidebar03 from "@/registry/blocks/sidebar-03/page"
import Sidebar05 from "@/registry/blocks/sidebar-05/page"
import Sidebar08 from "@/registry/blocks/sidebar-08/page"
import Sidebar09 from "@/registry/blocks/sidebar-09/page"
import Sidebar11 from "@/registry/blocks/sidebar-11/page"
import Sidebar12 from "@/registry/blocks/sidebar-12/page"

// The blocks on file, by registry name — what /view/<style>/<name> renders.
export const blockComponents: Record<string, React.ComponentType> = {
  "sidebar-12": Sidebar12,
  "sidebar-11": Sidebar11,
  "sidebar-03": Sidebar03,
  "sidebar-08": Sidebar08,
  "sidebar-05": Sidebar05,
  "dashboard-01": Dashboard01,
  "sidebar-09": Sidebar09,
}
