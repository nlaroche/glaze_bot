<script lang="ts">
  import type { InfoTableCommand } from '@glazebot/shared-types';

  let { command }: { command: InfoTableCommand } = $props();

  let positionStyle = $derived(anchorToCSS(command.position || 'top-right'));

  function anchorToCSS(anchor: string): string {
    const map: Record<string, string> = {
      'top-left': 'top: 5%; left: 5%;',
      'top-center': 'top: 5%; left: 50%; transform: translateX(-50%);',
      'top-right': 'top: 5%; right: 5%;',
      'center-left': 'top: 50%; left: 5%; transform: translateY(-50%);',
      'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
      'center-right': 'top: 50%; right: 5%; transform: translateY(-50%);',
      'bottom-left': 'bottom: 5%; left: 5%;',
      'bottom-center': 'bottom: 5%; left: 50%; transform: translateX(-50%);',
      'bottom-right': 'bottom: 5%; right: 5%;',
    };
    return map[anchor] || map['top-right'];
  }
</script>

<div class="table-panel" style={positionStyle}>
  <div class="table-title">{command.title}</div>
  <table>
    <thead>
      <tr>
        {#each command.headers as header}
          <th>{header}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each command.rows as row}
        <tr>
          {#each row as cell}
            <td>{cell}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-panel {
    position: absolute;
    background: rgba(10, 14, 24, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 16px;
    animation: panel-slide-in 0.4s ease-out;
    font-family: system-ui, sans-serif;
  }
  .table-title {
    font-size: 16px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
    margin-bottom: 10px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-align: left;
    padding: 4px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  td {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);
    padding: 5px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  tr:last-child td {
    border-bottom: none;
  }
  @keyframes panel-slide-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
